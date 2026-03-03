import { NextResponse } from "next/server";
import { readServerState } from "@/lib/server-state";

/**
 * Comprehensive n8n evaluation endpoint.
 * n8n calls GET /api/n8n/evaluate on a schedule.
 * Returns all check results in a single payload so n8n can route
 * notifications (email, SMS, Slack, push) based on which alerts fired.
 *
 * Optional query params:
 *   ?checks=spending,liquidity   (comma-separated, defaults to all)
 */
export async function GET(req: Request) {
  const state = await readServerState();

  if (!state || !state.profile) {
    return NextResponse.json({
      status: "no_data",
      timestamp: new Date().toISOString(),
      alerts: [],
      summary: "No synced profile. Ensure the PFRE app is running and a profile has been created.",
    });
  }

  const url = new URL(req.url);
  const requestedChecks = url.searchParams.get("checks")?.split(",").map(s => s.trim()) ?? null;

  const profile = state.profile as Record<string, unknown>;
  const plans = (state.rebalancingPlans ?? []) as Array<Record<string, unknown>>;
  const selectedPlanId = state.selectedPlanId as string | null;
  const activePlan = plans.find(p => p.id === selectedPlanId) as Record<string, unknown> | undefined;
  const rules = ((state.notificationSettings as Record<string, unknown>)?.rules as Array<Record<string, unknown>>) ?? [];
  const settings = state.notificationSettings as Record<string, unknown>;

  const income = (profile.monthlyIncome as number) ?? 0;
  const fixedExpenses = (profile.fixedExpenses as Array<{ amount: number }>) ?? [];
  const variableExpenses = (profile.variableExpenses as Array<{ amount: number }>) ?? [];
  const investments = profile.investments as { totalValue: number; monthlyContribution: number } | undefined;
  const cashBuffer = (profile.cashBuffer as number) ?? 0;

  const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = variableExpenses.reduce((s, e) => s + e.amount, 0);
  const reallocation = activePlan?.monthlyReallocation as Record<string, number> | undefined;

  interface Alert {
    check: string;
    alert: boolean;
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
    data: Record<string, unknown>;
  }

  const alerts: Alert[] = [];
  const shouldRun = (name: string) => !requestedChecks || requestedChecks.includes(name);

  // 1. Spending check
  if (shouldRun("spending") && activePlan && reallocation) {
    const variableCap = Math.round(income * (reallocation.variableExpenses ?? 20) / 100);
    const percentUsed = variableCap > 0 ? Math.round((totalVariable / variableCap) * 100) : 0;
    const spendingRule = rules.find(r => r.type === "spending_cap" && r.enabled);
    const threshold = (spendingRule?.threshold as number) ?? 100;
    const fired = percentUsed >= threshold;
    alerts.push({
      check: "spending",
      alert: fired,
      severity: fired ? (percentUsed >= 120 ? "critical" : "warning") : "info",
      title: "Spending Monitor",
      message: fired
        ? `Variable spending at ${percentUsed}% of plan cap ($${totalVariable} / $${variableCap}).`
        : `Spending within budget at ${percentUsed}%.`,
      data: { variableCap, actualSpending: totalVariable, percentUsed, threshold },
    });
  }

  // 2. Liquidity check
  if (shouldRun("liquidity")) {
    const monthsOfCoverage = totalFixed > 0 ? Math.round((cashBuffer / totalFixed) * 10) / 10 : 999;
    const liquidityRule = rules.find(r => r.type === "liquidity_floor" && r.enabled);
    const threshold = (liquidityRule?.threshold as number) ?? 2;
    const fired = monthsOfCoverage < threshold;
    alerts.push({
      check: "liquidity",
      alert: fired,
      severity: fired ? (monthsOfCoverage < 1 ? "critical" : "warning") : "info",
      title: "Liquidity Monitor",
      message: fired
        ? `Cash covers only ${monthsOfCoverage} months (threshold: ${threshold}).`
        : `Liquidity healthy — ${monthsOfCoverage} months.`,
      data: { cashBuffer, totalFixed, monthsOfCoverage, threshold },
    });
  }

  // 3. Risk score check
  if (shouldRun("risk_score") && state.stressResult) {
    const stress = state.stressResult as Record<string, unknown>;
    const score = (stress.riskScoreAfter as number) ?? 0;
    const riskRule = rules.find(r => r.type === "risk_score_alert" && r.enabled);
    const threshold = (riskRule?.threshold as number) ?? 60;
    const fired = score >= threshold;
    alerts.push({
      check: "risk_score",
      alert: fired,
      severity: fired ? (score >= 80 ? "critical" : "warning") : "info",
      title: "Risk Score Alert",
      message: fired
        ? `Risk score at ${score} (threshold: ${threshold}).`
        : `Risk score at ${score}, within safe zone.`,
      data: { riskScore: score, threshold },
    });
  }

  // 4. Drift check
  if (shouldRun("drift") && activePlan && reallocation) {
    const actualFixedPct = income > 0 ? Math.round((totalFixed / income) * 100) : 0;
    const actualVariablePct = income > 0 ? Math.round((totalVariable / income) * 100) : 0;
    const actualInvestPct = income > 0 ? Math.round(((investments?.monthlyContribution ?? 0) / income) * 100) : 0;

    const drifts = [
      { name: "Fixed", actual: actualFixedPct, planned: reallocation.fixedExpenses ?? 0 },
      { name: "Variable", actual: actualVariablePct, planned: reallocation.variableExpenses ?? 0 },
      { name: "Investments", actual: actualInvestPct, planned: reallocation.investments ?? 0 },
    ].map(d => ({ ...d, drift: Math.abs(d.actual - d.planned) }));

    const maxDrift = Math.max(...drifts.map(d => d.drift));
    const driftRule = rules.find(r => r.type === "drift_threshold" && r.enabled);
    const threshold = (driftRule?.threshold as number) ?? 10;
    const fired = maxDrift > threshold;
    alerts.push({
      check: "drift",
      alert: fired,
      severity: fired ? (maxDrift > threshold * 2 ? "critical" : "warning") : "info",
      title: "Allocation Drift",
      message: fired
        ? `Max drift at ${maxDrift}% (threshold: ${threshold}%).`
        : `Drift within bounds at ${maxDrift}%.`,
      data: { categories: drifts, maxDrift, threshold },
    });
  }

  // 5. Scheduled check-in
  if (shouldRun("checkin") && activePlan) {
    const checkinRule = rules.find(r => r.type === "scheduled_checkin" && r.enabled);
    const intervalDays = (checkinRule?.intervalDays as number) ?? 30;
    const planCreated = (activePlan.createdAt as string) ?? new Date().toISOString();
    const daysSince = Math.floor((Date.now() - new Date(planCreated).getTime()) / (1000 * 60 * 60 * 24));
    const due = daysSince >= intervalDays;
    alerts.push({
      check: "checkin",
      alert: due,
      severity: "info",
      title: "Scheduled Check-in",
      message: due
        ? `Check-in due: ${daysSince} days since plan started (interval: ${intervalDays}d).`
        : `Next check-in in ${intervalDays - daysSince} days.`,
      data: { daysSince, intervalDays, due },
    });
  }

  // 6. Reallocation opportunity (always runs)
  if (shouldRun("reallocation")) {
    const portfolioValue = investments?.totalValue ?? 0;
    const cashRunway = totalFixed > 0 ? cashBuffer / totalFixed : 999;
    const ratio = cashBuffer > 0 ? portfolioValue / cashBuffer : 0;
    const investmentHeavy = ratio > 5 && cashRunway < 3;
    const surplus = income - totalFixed - totalVariable - (investments?.monthlyContribution ?? 0);
    const hasSurplus = surplus > income * 0.05;
    const fired = investmentHeavy || hasSurplus;
    alerts.push({
      check: "reallocation",
      alert: fired,
      severity: "info",
      title: "Reallocation Opportunity",
      message: investmentHeavy
        ? `Portfolio is ${ratio.toFixed(1)}x cash. Consider rebalancing.`
        : hasSurplus
        ? `~$${Math.round(surplus).toLocaleString()}/mo unallocated surplus.`
        : "No reallocation opportunities.",
      data: { portfolioValue, cashBuffer, cashRunway: Math.round(cashRunway * 10) / 10, surplus: Math.max(0, Math.round(surplus)), investmentHeavy, hasSurplus },
    });
  }

  const firedAlerts = alerts.filter(a => a.alert);

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    lastSyncedAt: state.lastSyncedAt ?? null,
    profileName: (profile.name as string) ?? "Unknown",
    planActive: !!activePlan,
    planName: (activePlan?.name as string) ?? null,
    totalAlerts: firedAlerts.length,
    alerts,
    notificationPreferences: {
      pingWindow: `${settings?.pingWindowStart ?? "09:00"} – ${settings?.pingWindowEnd ?? "20:00"}`,
      frequency: settings?.frequency ?? "daily_digest",
      channels: settings?.channels ?? { inApp: true, sms: false, push: false },
    },
    summary: firedAlerts.length > 0
      ? `${firedAlerts.length} alert(s) fired: ${firedAlerts.map(a => a.check).join(", ")}.`
      : "All checks passed. No alerts.",
  });
}
