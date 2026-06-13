import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";
import { calculateAllocationDrift } from "@/lib/engine/monitoring";

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
  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const driftRule = rules.find(r => r.type === "drift_threshold" && r.enabled);
  const drift = calculateAllocationDrift({
    income,
    actualFixed,
    actualVariable,
    actualInvestment,
    reallocation,
    threshold: (driftRule?.threshold as number) ?? 10,
  });

  return NextResponse.json({
    status: "ok",
    check: "drift_detection",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      categories: drift.categories.map(category => ({
        name: category.name,
        actual: category.actualAmount,
        planned: category.plannedAmount,
        actualPct: category.actualPct,
        plannedPct: category.plannedPct,
        driftPct: category.driftPct,
      })),
      overallDrift: drift.overallDrift,
      threshold: drift.threshold,
      alert: drift.alert,
      alertLevel: drift.alert ? (drift.overallDrift > drift.threshold * 2 ? "critical" : "warning") : null,
      message: drift.alert
        ? `Allocation drift detected: ${drift.overallDrift}% (threshold: ${drift.threshold}%).`
        : `Allocation drift within bounds at ${drift.overallDrift}%.`,
    },
  });
}
