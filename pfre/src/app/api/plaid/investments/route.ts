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

    const holdingsResponse = await plaidClient.investmentsHoldingsGet({
      access_token,
    });

    const securities = holdingsResponse.data.securities;
    const securityMap = new Map(
      securities.map(s => [s.security_id, s]),
    );

    const holdings = holdingsResponse.data.holdings.map(h => {
      const security = securityMap.get(h.security_id);
      return {
        securityId: h.security_id,
        accountId: h.account_id,
        tickerSymbol: security?.ticker_symbol ?? null,
        name: security?.name ?? "Unknown Security",
        type: security?.type ?? "unknown",
        quantity: h.quantity,
        price: h.institution_price,
        priceAsOf: h.institution_price_as_of,
        costBasis: h.cost_basis,
        value: h.institution_value,
        currency: h.iso_currency_code ?? "USD",
        unrealizedGain: h.cost_basis
          ? h.institution_value - h.cost_basis
          : null,
        unrealizedGainPct: h.cost_basis && h.cost_basis > 0
          ? ((h.institution_value - h.cost_basis) / h.cost_basis) * 100
          : null,
      };
    });

    const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    const totalCostBasis = holdings.reduce((sum, h) => sum + (h.costBasis ?? 0), 0);

    let investmentTransactions: Array<{
      transactionId: string;
      accountId: string;
      date: string;
      name: string;
      type: string;
      quantity: number;
      price: number;
      fees: number;
      amount: number;
      tickerSymbol: string | null;
      securityName: string;
      currency: string;
    }> = [];

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const endDate = new Date();

      const txResponse = await plaidClient.investmentsTransactionsGet({
        access_token,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
      });

      investmentTransactions = txResponse.data.investment_transactions.map(tx => {
        const security = tx.security_id ? securityMap.get(tx.security_id) : null;
        return {
          transactionId: tx.investment_transaction_id,
          accountId: tx.account_id,
          date: tx.date,
          name: tx.name,
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          fees: tx.fees ?? 0,
          amount: tx.amount,
          tickerSymbol: security?.ticker_symbol ?? null,
          securityName: security?.name ?? tx.name,
          currency: tx.iso_currency_code ?? "USD",
        };
      });
    } catch {
      // Investment transactions may not be available for all items
    }

    const cashHolding = holdings.find(
      h => h.type === "cash" || h.tickerSymbol?.startsWith("CUR:"),
    );
    const equityHoldings = holdings.filter(
      h => h.type !== "cash" && !h.tickerSymbol?.startsWith("CUR:"),
    );

    const equityValue = equityHoldings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    const bondHoldings = equityHoldings.filter(
      h => h.name?.toLowerCase().includes("bond") || h.tickerSymbol === "BND",
    );
    const bondValue = bondHoldings.reduce((sum, h) => sum + (h.value ?? 0), 0);
    const stockValue = equityValue - bondValue;

    return NextResponse.json({
      holdings,
      investmentTransactions,
      summary: {
        totalValue,
        totalCostBasis,
        totalUnrealizedGain: totalValue - totalCostBasis,
        totalUnrealizedGainPct: totalCostBasis > 0
          ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
          : 0,
        cashBalance: cashHolding?.value ?? 0,
        equityValue: stockValue,
        bondValue,
        holdingsCount: equityHoldings.length,
      },
      accounts: holdingsResponse.data.accounts.map(a => ({
        accountId: a.account_id,
        name: a.name,
        type: a.type,
        balance: a.balances.current ?? 0,
      })),
    });
  } catch (error: unknown) {
    console.error("Plaid investments error:", error);
    const plaidError = (error as { response?: { data?: unknown } })?.response?.data;
    return NextResponse.json(
      { error: "Failed to fetch investment data", details: plaidError },
      { status: 500 },
    );
  }
}
