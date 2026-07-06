import { NextResponse } from "next/server";
import { getServerStateToken, readServerState } from "@/lib/server-state";
import { monthlyPlanAmount } from "@/lib/engine/monitoring";

function unauthorized() {
  return NextResponse.json({ error: "Missing or invalid sync token" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = getServerStateToken(req);
  if (!token) return unauthorized();

  const state = await readServerState(token);

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

  const fixedExpenses = (profile.fixedExpenses as Array<{ amount: number }>) ?? [];
  const variableExpenses = (profile.variableExpenses as Array<{ amount: number }>) ?? [];
  const investments = profile.investments as { totalValue: number; monthlyContribution: number } | undefined;

  const actualFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const actualVariable = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const actualInvestment = investments?.monthlyContribution ?? 0;

  const reallocation = activePlan.monthlyReallocation as Record<string, number> | undefined;
  const plannedFixed = monthlyPlanAmount(reallocation, "fixedExpenses");
  const plannedVariable = monthlyPlanAmount(reallocation, "variableExpenses");
  const plannedInvestment = monthlyPlanAmount(reallocation, "investments");

  const categories = [
    { name: "Fixed Expenses", actual: actualFixed, planned: plannedFixed, driftPct: plannedFixed > 0 ? Math.round(Math.abs(actualFixed - plannedFixed) / plannedFixed * 100) : 0 },
    { name: "Variable Expenses", actual: actualVariable, planned: plannedVariable, driftPct: plannedVariable > 0 ? Math.round(Math.abs(actualVariable - plannedVariable) / plannedVariable * 100) : 0 },
    { name: "Investments", actual: actualInvestment, planned: plannedInvestment, driftPct: plannedInvestment > 0 ? Math.round(Math.abs(actualInvestment - plannedInvestment) / plannedInvestment * 100) : 0 },
  ];

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
