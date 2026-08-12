import { NextResponse } from "next/server";
import { calculateSpendingCapUsage } from "@/lib/engine/spending-cap";
import { readServerState } from "@/lib/server-state";

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
  // monthlyReallocation buckets are dollar amounts (not % of income).
  const planBudget = typeof reallocation?.variableExpenses === "number"
    ? reallocation.variableExpenses
    : 0;
  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const spendingRule = rules.find(r => r.type === "spending_cap" && r.enabled);
  const threshold = (spendingRule?.threshold as number) ?? 100;
  const { variableCap, percentUsed, alert } = calculateSpendingCapUsage({
    planBudget,
    actualSpending,
    thresholdPct: threshold,
  });

  return NextResponse.json({
    status: "ok",
    check: "spending_monitor",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      variableSpendingCap: variableCap,
      actualSpendingThisMonth: actualSpending,
      percentUsed,
      thresholdPercent: threshold,
      daysRemainingInMonth: daysRemaining,
      alert,
      alertLevel: alert ? (percentUsed >= 120 || variableCap <= 0 ? "critical" : "warning") : null,
      message: alert
        ? variableCap <= 0
          ? `Variable spending $${actualSpending} with a $0 plan cap.`
          : `Variable spending at ${percentUsed}% of plan cap ($${actualSpending} / $${variableCap}).`
        : `Variable spending within budget at ${percentUsed}%.`,
    },
  });
}
