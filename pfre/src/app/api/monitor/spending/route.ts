import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";
import { amountFromReallocation, numericRuleValue, percentUsed } from "@/lib/engine/monitoring";

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
  const variableCap = amountFromReallocation(reallocation, "variableExpenses");
  const spendingPercentUsed = percentUsed(actualSpending, variableCap);
  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const spendingRule = rules.find(r => r.type === "spending_cap" && r.enabled);
  const threshold = numericRuleValue(spendingRule, "threshold", 100);
  const alert = spendingPercentUsed >= threshold;

  return NextResponse.json({
    status: "ok",
    check: "spending_monitor",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      variableSpendingCap: variableCap,
      actualSpendingThisMonth: actualSpending,
      percentUsed: spendingPercentUsed,
      thresholdPercent: threshold,
      daysRemainingInMonth: daysRemaining,
      alert,
      alertLevel: alert ? (spendingPercentUsed >= 120 ? "critical" : "warning") : null,
      message: alert
        ? `Variable spending at ${spendingPercentUsed}% of plan cap ($${actualSpending} / $${variableCap}).`
        : `Variable spending within budget at ${spendingPercentUsed}%.`,
    },
  });
}
