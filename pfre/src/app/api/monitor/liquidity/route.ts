import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";

export async function GET() {
  const state = await readServerState();

  if (!state) {
    return NextResponse.json({
      status: "ok",
      check: "liquidity_monitor",
      timestamp: new Date().toISOString(),
      data: { alert: false, message: "No state synced." },
    });
  }

  const profile = state.profile as Record<string, unknown> | null;
  if (!profile) {
    return NextResponse.json({
      status: "ok",
      check: "liquidity_monitor",
      timestamp: new Date().toISOString(),
      data: { alert: false, message: "No active profile." },
    });
  }

  const cashBuffer = (profile.cashBuffer as number) ?? 0;
  const fixedExpenses = (profile.fixedExpenses as Array<{ amount: number }>) ?? [];
  const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const monthsOfCoverage = totalFixed > 0 ? Math.round((cashBuffer / totalFixed) * 10) / 10 : 999;

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const liquidityRule = rules.find(r => r.type === "liquidity_floor" && r.enabled);
  const threshold = (liquidityRule?.threshold as number) ?? 2;
  const alert = monthsOfCoverage < threshold;

  return NextResponse.json({
    status: "ok",
    check: "liquidity_monitor",
    timestamp: new Date().toISOString(),
    data: {
      cashBuffer,
      fixedExpensesMonthly: totalFixed,
      monthsOfCoverage,
      threshold,
      alert,
      alertLevel: alert ? (monthsOfCoverage < 1 ? "critical" : "warning") : null,
      message: alert
        ? `Cash buffer covers only ${monthsOfCoverage} months of fixed expenses (threshold: ${threshold}).`
        : `Liquidity healthy — ${monthsOfCoverage} months of coverage.`,
    },
  });
}
