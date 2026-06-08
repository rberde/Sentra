import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";
import { evaluateSpendingBudget } from "@/lib/monitoring";

export async function GET() {
  const state = await readServerState();

  if (!state) {
    return NextResponse.json({
      status: "ok",
      check: "spending_monitor",
      timestamp: new Date().toISOString(),
      data: { planActive: false, alert: false, message: "No state synced. Client must be running." },
    });
  }

  const profile = state.profile as Record<string, unknown> | null;
  const plans = (state.rebalancingPlans ?? []) as Array<Record<string, unknown>>;
  const selectedPlanId = state.selectedPlanId as string | null;
  const activePlan = plans.find(p => p.id === selectedPlanId) as Record<string, unknown> | undefined;

  if (!profile || !activePlan) {
    return NextResponse.json({
      status: "ok",
      check: "spending_monitor",
      timestamp: new Date().toISOString(),
      data: {
        planActive: false,
        alert: false,
        message: "No active rebalancing plan. Monitoring inactive.",
      },
    });
  }

  const variableExpenses = (profile.variableExpenses as Array<{ amount: number }>) ?? [];
  const actualSpending = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const reallocation = activePlan.monthlyReallocation as Record<string, number> | undefined;
  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const spendingRule = rules.find(r => r.type === "spending_cap" && r.enabled);
  const spending = evaluateSpendingBudget(actualSpending, reallocation?.variableExpenses ?? 0, spendingRule?.threshold);

  return NextResponse.json({
    status: "ok",
    check: "spending_monitor",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      variableSpendingCap: spending.planBudget,
      actualSpendingThisMonth: spending.actualSpending,
      percentUsed: spending.percentUsed,
      thresholdPercent: spending.thresholdPct,
      daysRemainingInMonth: daysRemaining,
      alert: spending.alert,
      alertLevel: spending.alert ? (spending.percentUsed >= 120 ? "critical" : "warning") : null,
      message: spending.alert
        ? `Variable spending at ${spending.percentUsed}% of plan cap ($${spending.actualSpending} / $${spending.planBudget}).`
        : `Variable spending within budget at ${spending.percentUsed}%.`,
    },
  });
}
