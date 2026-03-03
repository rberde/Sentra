import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";

export async function POST() {
  const state = await readServerState();

  if (!state) {
    return NextResponse.json({
      status: "ok",
      check: "scheduled_checkin",
      timestamp: new Date().toISOString(),
      data: { planActive: false, alert: false, message: "No state synced." },
    });
  }

  const plans = (state.rebalancingPlans ?? []) as Array<Record<string, unknown>>;
  const selectedPlanId = state.selectedPlanId as string | null;
  const activePlan = plans.find(p => p.id === selectedPlanId) as Record<string, unknown> | undefined;

  if (!activePlan) {
    return NextResponse.json({
      status: "ok",
      check: "scheduled_checkin",
      timestamp: new Date().toISOString(),
      data: { planActive: false, alert: false, message: "No active plan for check-in." },
    });
  }

  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const checkinRule = rules.find(r => r.type === "scheduled_checkin" && r.enabled);
  const intervalDays = (checkinRule?.intervalDays as number) ?? 30;

  // Use plan activation time or last sync as reference
  const planCreated = (activePlan.createdAt as string) ?? (state.lastSyncedAt as string) ?? new Date().toISOString();
  const daysSince = Math.floor((Date.now() - new Date(planCreated).getTime()) / (1000 * 60 * 60 * 24));
  const nextCheckinDue = daysSince >= intervalDays;

  const profile = state.profile as Record<string, unknown> | null;
  const income = (profile?.monthlyIncome as number) ?? 0;
  const fixedExpenses = (profile?.fixedExpenses as Array<{ amount: number }>) ?? [];
  const variableExpenses = (profile?.variableExpenses as Array<{ amount: number }>) ?? [];
  const totalExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0) + variableExpenses.reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    status: "ok",
    check: "scheduled_checkin",
    timestamp: new Date().toISOString(),
    data: {
      planActive: true,
      planName: activePlan.name ?? "Active Plan",
      daysSincePlanActivation: daysSince,
      intervalDays,
      nextCheckinDue,
      alert: nextCheckinDue,
      alertLevel: nextCheckinDue ? "info" : null,
      summary: {
        monthlyIncome: income,
        totalExpenses,
        netMonthly: income - totalExpenses,
      },
      message: nextCheckinDue
        ? `Time for your ${intervalDays}-day check-in. ${daysSince} days since plan started.`
        : `Next check-in in ${intervalDays - daysSince} days.`,
    },
  });
}
