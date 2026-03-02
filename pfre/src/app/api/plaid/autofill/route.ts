import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json();
    if (!access_token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 400 });
    }

    const accountsResponse = await plaidClient.accountsGet({
      access_token,
    });

    const accounts = accountsResponse.data.accounts.map(a => ({
      accountId: a.account_id,
      name: a.name,
      type: mapAccountType(a.type, a.subtype ?? undefined),
      balance: a.balances.current ?? 0,
      institution: "Connected Institution",
    }));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const endDate = new Date();

    let fixedExpenses: Array<{ name: string; amount: number; category: string; type: "fixed" }> = [];
    let variableExpenses: Array<{ name: string; amount: number; category: string; type: "variable" }> = [];
    let expensesReason = "Imported from Plaid transactions.";

    try {
      const txResponse = await getTransactionsWithRetry(access_token, startDate, endDate);

      const estimates = buildExpenseEstimates(txResponse.data.transactions);
      fixedExpenses = estimates.fixedExpenses;
      variableExpenses = estimates.variableExpenses;
    } catch (txError) {
      console.warn("Plaid transactions fetch skipped:", txError);
      expensesReason = "Transactions were not ready from Plaid yet; balances imported only.";
    }

    const cashBuffer = accounts
      .filter(a => a.type === "checking" || a.type === "savings")
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    let investmentsTotalValue = accounts
      .filter(a => a.type === "investment")
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    let investmentHoldings: Array<{
      tickerSymbol: string | null;
      name: string;
      quantity: number;
      price: number;
      value: number;
      costBasis: number | null;
    }> = [];

    try {
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token,
      });
      const secMap = new Map(
        holdingsResponse.data.securities.map(s => [s.security_id, s]),
      );
      investmentHoldings = holdingsResponse.data.holdings.map(h => {
        const sec = secMap.get(h.security_id);
        return {
          tickerSymbol: sec?.ticker_symbol ?? null,
          name: sec?.name ?? "Unknown",
          quantity: h.quantity,
          price: h.institution_price,
          value: h.institution_value,
          costBasis: h.cost_basis,
        };
      });
      const holdingsTotal = investmentHoldings.reduce((s, h) => s + h.value, 0);
      if (holdingsTotal > 0) investmentsTotalValue = holdingsTotal;
    } catch {
      // Investments product may not be available
    }

    return NextResponse.json({
      accounts,
      autofill: {
        cashBuffer,
        investmentsTotalValue,
        investmentHoldings,
        fixedExpenses,
        variableExpenses,
      },
      autofillMeta: {
        expensesAutofilled: fixedExpenses.length + variableExpenses.length > 0,
        investmentsAutofilled: investmentHoldings.length > 0,
        expensesReason,
      },
    });
  } catch (error: unknown) {
    console.error("Plaid autofill error:", error);
    return NextResponse.json({ error: "Failed to refresh Plaid data" }, { status: 500 });
  }
}

async function getTransactionsWithRetry(accessToken: string, startDate: Date, endDate: Date) {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: toPlaidDate(startDate),
        end_date: toPlaidDate(endDate),
      });
    } catch (error) {
      const errorCode = (error as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      const shouldRetry = errorCode === "PRODUCT_NOT_READY" && attempt < maxAttempts - 1;
      if (!shouldRetry) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw new Error("Unable to fetch transactions");
}

function mapAccountType(
  plaidType: string,
  plaidSubtype?: string,
): "checking" | "savings" | "investment" | "credit" | "other" {
  switch (plaidType) {
    case "depository":
      return plaidSubtype === "savings" ? "savings" : "checking";
    case "investment": return "investment";
    case "credit": return "credit";
    default: return "other";
  }
}

function toPlaidDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildExpenseEstimates(transactions: Array<{
  name: string;
  amount: number;
  pending?: boolean;
  merchant_name?: string | null;
  personal_finance_category?: { primary?: string | null } | null;
}>): {
  fixedExpenses: Array<{ name: string; amount: number; category: string; type: "fixed" }>;
  variableExpenses: Array<{ name: string; amount: number; category: string; type: "variable" }>;
} {
  const expenseTx = transactions.filter(t => !t.pending && t.amount > 0);
  const monthlyFactor = 90 / 30;
  const grouped = new Map<string, {
    name: string;
    total: number;
    occurrences: number;
    category: string;
  }>();

  for (const tx of expenseTx) {
    const key = (tx.merchant_name || tx.name || "Unknown").trim().toLowerCase();
    const entry = grouped.get(key);
    const category = mapExpenseCategory(tx.personal_finance_category?.primary ?? "");
    if (entry) {
      entry.total += tx.amount;
      entry.occurrences += 1;
    } else {
      grouped.set(key, {
        name: tx.merchant_name || tx.name || "Expense",
        total: tx.amount,
        occurrences: 1,
        category,
      });
    }
  }

  const fixedExpenses: Array<{ name: string; amount: number; category: string; type: "fixed" }> = [];
  const variableExpenses: Array<{ name: string; amount: number; category: string; type: "variable" }> = [];

  for (const entry of grouped.values()) {
    const monthlyAmount = Number((entry.total / monthlyFactor).toFixed(2));
    if (monthlyAmount < 20) continue;

    const normalized = {
      name: entry.name,
      amount: monthlyAmount,
      category: entry.category,
    };
    const looksFixed =
      entry.occurrences >= 3 ||
      entry.category === "housing" ||
      entry.category === "insurance" ||
      entry.category === "loans" ||
      entry.category === "subscriptions";

    if (looksFixed) {
      fixedExpenses.push({ ...normalized, type: "fixed" });
    } else {
      variableExpenses.push({ ...normalized, type: "variable" });
    }
  }

  fixedExpenses.sort((a, b) => b.amount - a.amount);
  variableExpenses.sort((a, b) => b.amount - a.amount);

  return {
    fixedExpenses: fixedExpenses.slice(0, 10),
    variableExpenses: variableExpenses.slice(0, 15),
  };
}

function mapExpenseCategory(primary: string): "housing" | "transport" | "food" | "insurance" | "loans" | "subscriptions" | "entertainment" | "shopping" | "other" {
  const value = primary.toUpperCase();
  if (value.includes("RENT") || value.includes("MORTGAGE") || value.includes("HOUSING")) return "housing";
  if (value.includes("TRANSPORT") || value.includes("GAS") || value.includes("AUTOMOTIVE")) return "transport";
  if (value.includes("FOOD") || value.includes("RESTAURANT") || value.includes("GROCERY")) return "food";
  if (value.includes("INSURANCE")) return "insurance";
  if (value.includes("LOAN") || value.includes("DEBT")) return "loans";
  if (value.includes("SUBSCRIPTION") || value.includes("BILL")) return "subscriptions";
  if (value.includes("ENTERTAINMENT") || value.includes("TRAVEL")) return "entertainment";
  if (value.includes("SHOPPING") || value.includes("GENERAL_MERCHANDISE")) return "shopping";
  return "other";
}
