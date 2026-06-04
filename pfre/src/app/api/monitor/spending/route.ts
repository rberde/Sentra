import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";
import { calculateSpendingUsage } from "@/lib/engine/monitoring";

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
  const threshold = (spendingRule?.threshold as number) ?? 100;
  const usage = calculateSpendingUsage(actualSpending, reallocation, threshold);

  return NextResponse.json({
    status: "ok",
    check: "spending_monitor",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      variableSpendingCap: usage.variableCap,
      actualSpendingThisMonth: actualSpending,
      percentUsed: usage.percentUsed,
      thresholdPercent: threshold,
      daysRemainingInMonth: daysRemaining,
      alert: usage.alert,
      alertLevel: usage.alert ? (usage.percentUsed >= 120 ? "critical" : "warning") : null,
      message: usage.alert
        ? `Variable spending at ${usage.percentUsed}% of plan cap ($${actualSpending} / $${usage.variableCap}).`
        : `Variable spending within budget at ${usage.percentUsed}%.`,
    },
  });
}
