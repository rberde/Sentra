import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { buildExpenseEstimates, type EstimatedExpense } from "@/lib/plaid-expenses";

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

    let fixedExpenses: EstimatedExpense[] = [];
    let variableExpenses: EstimatedExpense[] = [];
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

