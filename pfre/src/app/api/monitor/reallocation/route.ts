import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";

export async function GET() {
  const state = await readServerState();

  if (!state) {
    return NextResponse.json({
      status: "ok",
      check: "reallocation_opportunity",
      timestamp: new Date().toISOString(),
      data: { alert: false, message: "No state synced." },
    });
  }

  const profile = state.profile as Record<string, unknown> | null;
  if (!profile) {
    return NextResponse.json({
      status: "ok",
      check: "reallocation_opportunity",
      timestamp: new Date().toISOString(),
      data: { alert: false, message: "No active profile." },
    });
  }

  const income = (profile.monthlyIncome as number) ?? 0;
  const fixedExpenses = (profile.fixedExpenses as Array<{ amount: number }>) ?? [];
  const variableExpenses = (profile.variableExpenses as Array<{ amount: number }>) ?? [];
  const investments = profile.investments as { totalValue: number; monthlyContribution: number } | undefined;
  const cashBuffer = (profile.cashBuffer as number) ?? 0;

  const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const surplus = income - totalExpenses - (investments?.monthlyContribution ?? 0);

  const portfolioValue = investments?.totalValue ?? 0;
  const cashRunwayMonths = totalFixed > 0 ? cashBuffer / totalFixed : 999;

  // Flag opportunities: large portfolio relative to cash, or unallocated surplus
  const portfolioToCash = cashBuffer > 0 ? portfolioValue / cashBuffer : 0;
  const investmentHeavy = portfolioToCash > 5 && cashRunwayMonths < 3;
  const hasSurplus = surplus > income * 0.05;
  const alert = investmentHeavy || hasSurplus;

  return NextResponse.json({
    status: "ok",
    check: "reallocation_opportunity",
    timestamp: new Date().toISOString(),
    data: {
      portfolioValue,
      cashBuffer,
      cashRunwayMonths: Math.round(cashRunwayMonths * 10) / 10,
      monthlySurplus: Math.max(0, Math.round(surplus)),
      portfolioToCashRatio: Math.round(portfolioToCash * 10) / 10,
      investmentHeavy,
      hasSurplus,
      alert,
      alertLevel: alert ? "info" : null,
      message: investmentHeavy
        ? `Portfolio ($${portfolioValue.toLocaleString()}) is ${portfolioToCash.toFixed(1)}x cash. Consider rebalancing to improve liquidity.`
        : hasSurplus
        ? `You have ~$${Math.round(surplus).toLocaleString()}/mo unallocated. Consider directing it to savings or cash buffer.`
        : "No reallocation opportunities detected.",
    },
  });
}
