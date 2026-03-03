import type { AppState } from "@/lib/store";
import type { Notification, NotificationRule } from "@/lib/types";

/**
 * Evaluates all enabled notification rules against the current app state.
 * Returns an array of Notification objects for any rules that are breached.
 * This runs client-side for instant feedback; the same logic can power
 * server-side API routes for n8n later.
 */
export function runAgentChecks(state: AppState): Notification[] {
  const { profile, notificationSettings, rebalancingPlans, selectedPlanId, stressResult } = state;
  if (!profile) return [];

  const activePlan = rebalancingPlans.find(p => p.id === selectedPlanId);
  const rules = notificationSettings.rules.filter(r => r.enabled);
  const results: Notification[] = [];
  const totalFixed = profile.fixedExpenses.reduce((s, e) => s + e.amount, 0);
  const totalVariable = profile.variableExpenses.reduce((s, e) => s + e.amount, 0);

  for (const rule of rules) {
    const notif = evaluateRule(rule, {
      profile,
      activePlan: activePlan ?? null,
      stressResult,
      totalFixed,
      totalVariable,
      existingNotifications: state.notifications,
    });
    if (notif) results.push(notif);
  }

  // Proactive AI suggestions (run regardless of rules)
  const proactive = runProactiveChecks(state, totalFixed, totalVariable);
  results.push(...proactive);

  return results;
}

interface EvalContext {
  profile: NonNullable<AppState["profile"]>;
  activePlan: AppState["rebalancingPlans"][number] | null;
  stressResult: AppState["stressResult"];
  totalFixed: number;
  totalVariable: number;
  existingNotifications: AppState["notifications"];
}

function evaluateRule(rule: NotificationRule, ctx: EvalContext): Notification | null {
  switch (rule.type) {
    case "spending_cap":
      return checkSpendingCap(rule, ctx);
    case "liquidity_floor":
      return checkLiquidityFloor(rule, ctx);
    case "risk_score_alert":
      return checkRiskScore(rule, ctx);
    case "drift_threshold":
      return checkDrift(rule, ctx);
    case "scheduled_checkin":
      return checkScheduledCheckin(rule, ctx);
    default:
      return null;
  }
}

function checkSpendingCap(rule: NotificationRule, ctx: EvalContext): Notification | null {
  if (!ctx.activePlan) return null;
  const planBudget = ctx.activePlan.monthlyReallocation.variableExpenses;
  if (planBudget <= 0) return null;

  const actualSpending = ctx.totalVariable;
  const thresholdPct = rule.threshold ?? 100;
  const cap = planBudget * (thresholdPct / 100);

  if (actualSpending <= cap) return null;

  const overBy = Math.round(((actualSpending - planBudget) / planBudget) * 100);
  return {
    id: crypto.randomUUID(),
    type: "spending_limit",
    title: "Spending Alert",
    message: `Your variable spending ($${actualSpending.toLocaleString()}/mo) is ${overBy}% over your plan budget of $${planBudget.toLocaleString()}/mo. Consider reviewing your spending or adjusting your plan.`,
    severity: overBy > 50 ? "urgent" : "warning",
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };
}

function checkLiquidityFloor(rule: NotificationRule, ctx: EvalContext): Notification | null {
  if (ctx.totalFixed <= 0) return null;
  const thresholdMonths = rule.threshold ?? 2;
  const monthsOfCoverage = ctx.profile.cashBuffer / ctx.totalFixed;

  if (monthsOfCoverage >= thresholdMonths) return null;

  return {
    id: crypto.randomUUID(),
    type: "liquidity_warning",
    title: "Liquidity Warning",
    message: `Your cash ($${ctx.profile.cashBuffer.toLocaleString()}) covers only ${monthsOfCoverage.toFixed(1)} months of fixed expenses ($${ctx.totalFixed.toLocaleString()}/mo). Threshold is ${thresholdMonths} months.`,
    severity: monthsOfCoverage < 1 ? "urgent" : "warning",
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };
}

function checkRiskScore(rule: NotificationRule, ctx: EvalContext): Notification | null {
  if (!ctx.stressResult) return null;
  const threshold = rule.threshold ?? 60;
  const score = ctx.stressResult.riskScoreAfter;

  if (score <= threshold) return null;

  return {
    id: crypto.randomUUID(),
    type: "spending_limit",
    title: "Risk Score Alert",
    message: `Your risk score is ${score}, which exceeds the safe threshold of ${threshold}. Consider reviewing your risk events or rebalancing plan.`,
    severity: score > 80 ? "urgent" : "warning",
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };
}

function checkDrift(rule: NotificationRule, ctx: EvalContext): Notification | null {
  if (!ctx.activePlan) return null;
  const thresholdPct = rule.threshold ?? 10;
  const plan = ctx.activePlan.monthlyReallocation;
  const income = ctx.profile.monthlyIncome;
  if (income <= 0) return null;

  const actualPcts = {
    fixedExpenses: (ctx.totalFixed / income) * 100,
    variableExpenses: (ctx.totalVariable / income) * 100,
    investments: (ctx.profile.investments.monthlyContribution / income) * 100,
  };

  const planPcts = {
    fixedExpenses: (plan.fixedExpenses / income) * 100,
    variableExpenses: (plan.variableExpenses / income) * 100,
    investments: (plan.investments / income) * 100,
  };

  const drifts: string[] = [];
  for (const [key, actual] of Object.entries(actualPcts)) {
    const planned = planPcts[key as keyof typeof planPcts];
    const drift = Math.abs(actual - planned);
    if (drift > thresholdPct) {
      drifts.push(`${key.replace(/([A-Z])/g, " $1").trim()} drifted ${Math.round(drift)}%`);
    }
  }

  if (drifts.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    type: "drift_alert",
    title: "Allocation Drift Detected",
    message: `Your spending has drifted from the plan: ${drifts.join(", ")}. This may delay your financial goals.`,
    severity: drifts.length > 1 ? "urgent" : "warning",
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };
}

function checkScheduledCheckin(rule: NotificationRule, ctx: EvalContext): Notification | null {
  const intervalDays = rule.intervalDays ?? 30;
  const lastCheckin = ctx.existingNotifications
    .filter(n => n.type === "scheduled_checkin" && !n.isDismissed)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (lastCheckin) {
    const daysSince = (Date.now() - new Date(lastCheckin.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < intervalDays) return null;
  }

  return {
    id: crypto.randomUUID(),
    type: "scheduled_checkin",
    title: "Time for a Check-In",
    message: `It's been a while since your last review. Take a moment to check if your plan is still on track and adjust if needed.`,
    severity: "info",
    isDismissed: false,
    createdAt: new Date().toISOString(),
  };
}

// ── Proactive AI Suggestions ──
// These run independently of notification rules and detect positive or neutral
// opportunities the user should know about (investment growth, surplus cash, etc.)

function runProactiveChecks(state: AppState, totalFixed: number, totalVariable: number): Notification[] {
  const { profile, rebalancingPlans, selectedPlanId, notifications } = state;
  if (!profile) return [];

  const results: Notification[] = [];
  const activePlan = rebalancingPlans.find(p => p.id === selectedPlanId);
  const income = profile.monthlyIncome;
  const totalExpenses = totalFixed + totalVariable;
  const investContrib = profile.investments.monthlyContribution;
  const savingsContrib = profile.savingsGoal?.monthlyContribution ?? 0;
  const monthlySurplus = income - totalExpenses - investContrib - savingsContrib;

  // Avoid duplicate proactive suggestions by checking recent notifications
  const recentTitles = new Set(
    notifications
      .filter(n => !n.isDismissed && Date.now() - new Date(n.createdAt).getTime() < 1000 * 60 * 60 * 24)
      .map(n => n.title)
  );

  // 1. Investment growth opportunity: portfolio is large relative to cash
  //    Suggest moving some gains to cash to improve liquidity
  if (profile.investments.totalValue > 0 && profile.cashBuffer > 0) {
    const investToCashRatio = profile.investments.totalValue / profile.cashBuffer;
    const cashMonths = totalFixed > 0 ? profile.cashBuffer / totalFixed : 99;

    if (investToCashRatio > 8 && cashMonths < 4 && !recentTitles.has("Investment Rebalancing Opportunity")) {
      const suggestedMove = Math.round(profile.investments.totalValue * 0.05);
      results.push({
        id: crypto.randomUUID(),
        type: "reallocation_opportunity",
        title: "Investment Rebalancing Opportunity",
        message: `Your investments ($${profile.investments.totalValue.toLocaleString()}) are ${Math.round(investToCashRatio)}x your cash reserve ($${profile.cashBuffer.toLocaleString()}). Consider moving ~$${suggestedMove.toLocaleString()} (5%) to cash to strengthen your safety net to ${totalFixed > 0 ? Math.round((profile.cashBuffer + suggestedMove) / totalFixed) : "several"} months of expenses.`,
        severity: "info",
        isDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. Monthly surplus detected: user is earning more than spending
  //    Suggest allocating the surplus towards goals or investments
  if (monthlySurplus > income * 0.1 && !recentTitles.has("Surplus Detected")) {
    const cashMonths = totalFixed > 0 ? profile.cashBuffer / totalFixed : 99;
    let suggestion: string;
    if (cashMonths < 3) {
      suggestion = `Consider putting $${Math.round(monthlySurplus * 0.7).toLocaleString()}/mo toward your cash reserve (currently ${cashMonths.toFixed(1)} months of expenses) and $${Math.round(monthlySurplus * 0.3).toLocaleString()}/mo toward investments.`;
    } else if (profile.savingsGoal && profile.savingsGoal.currentBalance < profile.savingsGoal.targetAmount) {
      const remaining = profile.savingsGoal.targetAmount - profile.savingsGoal.currentBalance;
      suggestion = `Consider splitting it: $${Math.round(monthlySurplus * 0.5).toLocaleString()}/mo toward "${profile.savingsGoal.name}" (${Math.round(remaining / (monthlySurplus * 0.5))} months to target) and $${Math.round(monthlySurplus * 0.5).toLocaleString()}/mo into investments.`;
    } else {
      suggestion = `Consider increasing your investment contributions by $${Math.round(monthlySurplus * 0.6).toLocaleString()}/mo and keeping $${Math.round(monthlySurplus * 0.4).toLocaleString()}/mo as additional cash buffer.`;
    }
    results.push({
      id: crypto.randomUUID(),
      type: "reallocation_opportunity",
      title: "Surplus Detected",
      message: `You have ~$${Math.round(monthlySurplus).toLocaleString()}/mo unallocated after expenses and contributions. ${suggestion}`,
      severity: "info",
      isDismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Plan is active but spending is well under budget — positive reinforcement
  if (activePlan && activePlan.monthlyReallocation.variableExpenses > 0) {
    const underBudgetPct = ((activePlan.monthlyReallocation.variableExpenses - totalVariable) / activePlan.monthlyReallocation.variableExpenses) * 100;
    if (underBudgetPct > 20 && !recentTitles.has("Under Budget")) {
      const saved = Math.round(activePlan.monthlyReallocation.variableExpenses - totalVariable);
      results.push({
        id: crypto.randomUUID(),
        type: "reallocation_opportunity",
        title: "Under Budget",
        message: `Great news! Your variable spending is ${Math.round(underBudgetPct)}% under your plan budget — you're saving an extra $${saved.toLocaleString()}/mo. Consider moving that surplus toward your cash reserve or investments to accelerate your recovery.`,
        severity: "info",
        isDismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return results;
}
