import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";

export async function GET() {
  const state = await readServerState();

  if (!state) {
    return NextResponse.json({
      status: "ok",
      check: "drift_detection",
      timestamp: new Date().toISOString(),
      data: { planActive: false, alert: false, message: "No state synced." },
    });
  }

  const profile = state.profile as Record<string, unknown> | null;
  const plans = (state.rebalancingPlans ?? []) as Array<Record<string, unknown>>;
  const selectedPlanId = state.selectedPlanId as string | null;
  const activePlan = plans.find(p => p.id === selectedPlanId) as Record<string, unknown> | undefined;

  if (!profile || !activePlan) {
    return NextResponse.json({
      status: "ok",
      check: "drift_detection",
      timestamp: new Date().toISOString(),
      data: { planActive: false, alert: false, message: "No active plan for drift detection." },
    });
  }

  const income = (profile.monthlyIncome as number) ?? 0;
  const fixedExpenses = (profile.fixedExpenses as Array<{ amount: number }>) ?? [];
  const variableExpenses = (profile.variableExpenses as Array<{ amount: number }>) ?? [];
  const investments = profile.investments as { totalValue: number; monthlyContribution: number } | undefined;

  const actualFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const actualVariable = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const actualInvestment = investments?.monthlyContribution ?? 0;

  const reallocation = activePlan.monthlyReallocation as Record<string, number> | undefined;
  const plannedFixed = reallocation ? Math.round(reallocation.fixedExpenses ?? 0) : 0;
  const plannedVariable = reallocation ? Math.round(reallocation.variableExpenses ?? 0) : 0;
  const plannedInvestment = reallocation ? Math.round(reallocation.investments ?? 0) : 0;
  const toIncomePct = (amount: number) => income > 0 ? (amount / income) * 100 : 0;

  const categories = [
    { name: "Fixed Expenses", actual: actualFixed, planned: plannedFixed },
    { name: "Variable Expenses", actual: actualVariable, planned: plannedVariable },
    { name: "Investments", actual: actualInvestment, planned: plannedInvestment },
  ].map(c => ({
    ...c,
    actualPct: Math.round(toIncomePct(c.actual)),
    plannedPct: Math.round(toIncomePct(c.planned)),
    driftPct: Math.round(Math.abs(toIncomePct(c.actual) - toIncomePct(c.planned))),
  }));

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const driftRule = rules.find(r => r.type === "drift_threshold" && r.enabled);
  const threshold = (driftRule?.threshold as number) ?? 10;
  const overallDrift = Math.max(...categories.map(c => c.driftPct));
  const alert = overallDrift > threshold;

  return NextResponse.json({
    status: "ok",
    check: "drift_detection",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      categories,
      overallDrift,
      threshold,
      alert,
      alertLevel: alert ? (overallDrift > threshold * 2 ? "critical" : "warning") : null,
      message: alert
        ? `Allocation drift detected: ${overallDrift}% (threshold: ${threshold}%).`
        : `Allocation drift within bounds at ${overallDrift}%.`,
    },
  });
}
