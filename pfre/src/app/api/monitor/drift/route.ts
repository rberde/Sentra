import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";
import { amountFromReallocation, driftPercentPoints, numericRuleValue } from "@/lib/engine/monitoring";

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
  const plannedFixed = amountFromReallocation(reallocation, "fixedExpenses");
  const plannedVariable = amountFromReallocation(reallocation, "variableExpenses");
  const plannedInvestment = amountFromReallocation(reallocation, "investments");

  const categories = [
    { name: "Fixed Expenses", actual: actualFixed, planned: plannedFixed, driftPct: driftPercentPoints(actualFixed, plannedFixed, income) },
    { name: "Variable Expenses", actual: actualVariable, planned: plannedVariable, driftPct: driftPercentPoints(actualVariable, plannedVariable, income) },
    { name: "Investments", actual: actualInvestment, planned: plannedInvestment, driftPct: driftPercentPoints(actualInvestment, plannedInvestment, income) },
  ];

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const driftRule = rules.find(r => r.type === "drift_threshold" && r.enabled);
  const threshold = numericRuleValue(driftRule, "threshold", 10);
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
