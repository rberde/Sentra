import { NextResponse } from "next/server";
import { requireMonitorApiKey } from "@/lib/api-auth";
import { readServerState } from "@/lib/server-state";

export async function GET(req: Request) {
  const unauthorized = requireMonitorApiKey(req);
  if (unauthorized) return unauthorized;

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
  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const spendingRule = rules.find(r => r.type === "spending_cap" && r.enabled);
  const threshold = (spendingRule?.threshold as number) ?? 100;
  const planBudget = reallocation?.variableExpenses ?? 0;
  const variableCap = resolveSpendingCap(planBudget, spendingRule);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const alert = variableCap > 0 && actualSpending > variableCap;

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
      alertLevel: alert ? (percentUsed >= 120 ? "critical" : "warning") : null,
      message: alert
        ? `Variable spending at ${percentUsed}% of plan cap ($${actualSpending} / $${variableCap}).`
        : `Variable spending within budget at ${percentUsed}%.`,
    },
  });
}

function resolveSpendingCap(planBudget: number, rule: Record<string, unknown> | undefined): number {
  const threshold = (rule?.threshold as number | undefined) ?? 100;
  if (rule?.aiGenerated && threshold > 100) return threshold;
  return planBudget * (threshold / 100);
}
