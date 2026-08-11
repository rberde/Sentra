import type {
  UserProfile,
  StressResult,
  RebalancingPlan,
  BucketReallocation,
  MonthProjection,
  PlanType,
} from "@/lib/types";
import { normalizeWeights } from "./risk-engine";

function projectMonth(
  startCash: number,
  startSavings: number,
  startInvestments: number,
  monthlyIncome: number,
  reallocation: BucketReallocation,
  months: number,
  investmentGrowthRate: number = 0.005,
): MonthProjection {
  let cash = startCash;
  let savings = startSavings;
  let investments = startInvestments;
  let cumExpenses = 0;

  for (let m = 0; m < months; m++) {
    const totalExpenses = reallocation.fixedExpenses + reallocation.variableExpenses;
    cumExpenses += totalExpenses;

    cash += monthlyIncome - totalExpenses - reallocation.investments - reallocation.savingsGoal + reallocation.cashBuffer;
    savings += reallocation.savingsGoal;
    investments = investments * (1 + investmentGrowthRate) + reallocation.investments;

    cash = Math.max(0, cash);
    savings = Math.max(0, savings);
  }

  return {
    month: months,
    cashBuffer: Math.round(cash),
    savingsBalance: Math.round(savings),
    investmentValue: Math.round(investments),
    cumulativeExpenses: Math.round(cumExpenses),
    netPosition: Math.round(cash + savings + investments),
  };
}

type CutBucket = "variable" | "pause" | "redirect";

/** Apply a cut waterfall, clamping each bucket to remaining capacity. */
function allocateCuts(
  amountNeeded: number,
  softConstraints: number,
  pausable: number,
  redirectable: number,
  steps: Array<{ bucket: CutBucket; maxFraction?: number }>,
): { variableCut: number; pauseCut: number; redirectCut: number } {
  let remaining = Math.max(0, amountNeeded);
  let variableCut = 0;
  let pauseCut = 0;
  let redirectCut = 0;

  for (const step of steps) {
    if (remaining <= 0) break;
    if (step.bucket === "variable") {
      const cap = softConstraints * (step.maxFraction ?? 1);
      const cut = Math.min(Math.max(0, cap - variableCut), remaining);
      variableCut += cut;
      remaining -= cut;
    } else if (step.bucket === "pause") {
      const cut = Math.min(Math.max(0, pausable - pauseCut), remaining);
      pauseCut += cut;
      remaining -= cut;
    } else {
      const cut = Math.min(Math.max(0, redirectable - redirectCut), remaining);
      redirectCut += cut;
      remaining -= cut;
    }
  }

  return { variableCut, pauseCut, redirectCut };
}

function buildPlan(
  type: PlanType,
  name: string,
  profile: UserProfile,
  stress: StressResult,
  reallocation: BucketReallocation,
  description: string,
): RebalancingPlan {
  const effectiveIncome = stress.adjustedIncome;

  const freeablePerMonth = (
    stress.constraintMap.softConstraints - reallocation.variableExpenses +
    stress.constraintMap.pausable - reallocation.investments +
    stress.constraintMap.redirectable - reallocation.savingsGoal
  );
  const monthlyGap = Math.max(0, reallocation.fixedExpenses + reallocation.variableExpenses - effectiveIncome);
  const totalPressure = stress.additionalExpense > 0 ? stress.additionalExpense : monthlyGap * stress.crisisDurationMonths;
  const savingsBalance = profile.savingsGoal?.currentBalance ?? 0;
  const availableLiquidity = profile.cashBuffer + savingsBalance;

  // If the plan still runs a monthly expense deficit, cuts cannot "resolve" the crisis —
  // report runway against the remaining gap instead of inventing a freeable-based timeline.
  let timelineToResolve: number;
  if (monthlyGap > 0) {
    timelineToResolve = availableLiquidity > 0
      ? Math.ceil(availableLiquidity / monthlyGap)
      : 0;
  } else if (freeablePerMonth > 0 && totalPressure > 0) {
    timelineToResolve = Math.ceil(totalPressure / freeablePerMonth);
  } else {
    timelineToResolve = 0;
  }

  const originalMonthlyInvContrib = profile.investments.monthlyContribution;
  const originalMonthlySavContrib = profile.savingsGoal?.monthlyContribution ?? 0;
  const originalVariableSpending = stress.constraintMap.softConstraints;

  const investmentGapPerMonth = originalMonthlyInvContrib - reallocation.investments;
  const savingsGapPerMonth = originalMonthlySavContrib - reallocation.savingsGoal;

  const investmentGoalDelay = investmentGapPerMonth > 0 && originalMonthlyInvContrib > 0
    ? Math.round(timelineToResolve * (investmentGapPerMonth / originalMonthlyInvContrib))
    : 0;
  const savingsGoalDelay = savingsGapPerMonth > 0 && originalMonthlySavContrib > 0
    ? Math.round(timelineToResolve * (savingsGapPerMonth / originalMonthlySavContrib))
    : 0;
  const lifestyleReduction = originalVariableSpending > 0
    ? Math.round((1 - reallocation.variableExpenses / originalVariableSpending) * 100)
    : 0;

  const growthRate = stress.portfolioStressValue < profile.investments.totalValue ? 0 : 0.005;

  return {
    id: `plan_${type}_${Date.now()}`,
    type,
    name,
    description,
    monthlyReallocation: reallocation,
    timelineToResolve,
    goalImpact: {
      investmentGoalDelay,
      savingsGoalDelay,
      lifestyleReduction: Math.max(0, lifestyleReduction),
    },
    projections: {
      month6: projectMonth(profile.cashBuffer, savingsBalance, stress.portfolioStressValue, effectiveIncome, reallocation, 6, growthRate),
      month12: projectMonth(profile.cashBuffer, savingsBalance, stress.portfolioStressValue, effectiveIncome, reallocation, 12, growthRate),
      month24: projectMonth(profile.cashBuffer, savingsBalance, stress.portfolioStressValue, effectiveIncome, reallocation, 24, growthRate),
    },
    tradeoffSummary: description,
  };
}

export function generateRebalancingPlans(
  profile: UserProfile,
  stress: StressResult,
): RebalancingPlan[] {
  const weights = normalizeWeights(profile.goalWeights);
  const cm = stress.constraintMap;
  const hasSavingsGoal = profile.savingsGoal !== null;

  // Monthly pressure: the actual gap between what you spend and what you earn after the shock.
  // For income shocks (job loss), income drops → big recurring gap even if expenses don't change.
  // For expense shocks, expenses rise or there's a lump sum → spread over crisis horizon.
  const recurringGap = Math.max(0, stress.adjustedMonthlyBurn - stress.adjustedIncome);
  const lumpSumPressure = stress.additionalExpense > 0
    ? stress.additionalExpense / Math.max(1, stress.crisisDurationMonths)
    : 0;
  const rawNeeded = Math.max(recurringGap, lumpSumPressure);
  const maxFlexible = cm.softConstraints + cm.pausable + cm.redirectable;
  const amountNeeded = Math.max(0, Math.min(rawNeeded, maxFlexible));

  const formatDollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const hasIncomeShock = stress.adjustedIncome < profile.monthlyIncome;
  const durationLabel = stress.crisisDurationMonths <= 6
    ? `${stress.crisisDurationMonths}-month planning horizon`
    : `${stress.crisisDurationMonths} months`;
  const liquidity = profile.cashBuffer + (profile.savingsGoal?.currentBalance ?? 0);
  const shortfallNote = (monthlyShortfall: number) =>
    monthlyShortfall > 0 && liquidity > 0
      ? ` Even after cuts, there's a ${formatDollars(monthlyShortfall)}/mo shortfall that draws from your cash reserve (${Math.round(liquidity / monthlyShortfall)} months of runway).`
      : monthlyShortfall > 0
        ? ` Even after cuts, there's a ${formatDollars(monthlyShortfall)}/mo shortfall and no cash reserve left to cover it.`
        : "";

  const toReallocation = (cuts: { variableCut: number; pauseCut: number; redirectCut: number }): BucketReallocation => ({
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - cuts.variableCut),
    investments: Math.max(0, cm.pausable - cuts.pauseCut),
    savingsGoal: Math.max(0, cm.redirectable - cuts.redirectCut),
    cashBuffer: 0,
  });

  const planShortfall = (reallocation: BucketReallocation) =>
    Math.max(0, reallocation.fixedExpenses + reallocation.variableExpenses - stress.adjustedIncome);

  // ── Plan 1: Maximize Lifestyle — pause/redirect first, cut variable last ──
  const lifestyleCuts = allocateCuts(amountNeeded, cm.softConstraints, cm.pausable, cm.redirectable, [
    { bucket: "pause" },
    { bucket: "redirect" },
    { bucket: "variable", maxFraction: 1 },
  ]);
  const lifestylePlan = toReallocation(lifestyleCuts);

  const plans: RebalancingPlan[] = [
    buildPlan(
      "maximize_lifestyle",
      hasIncomeShock ? "Short-Term: Preserve Lifestyle" : "Maximize Lifestyle",
      profile,
      stress,
      lifestylePlan,
      `${hasIncomeShock ? `During your income disruption (${durationLabel}), this plan ` : "This plan "}keeps your lifestyle as close to normal as possible by pausing ${formatDollars(lifestyleCuts.pauseCut)}/month in investment contributions${lifestyleCuts.redirectCut > 0 ? ` and redirecting ${formatDollars(lifestyleCuts.redirectCut)}/month from your savings goal` : ""}. Variable spending stays at ${formatDollars(lifestylePlan.variableExpenses)}/month (${cm.softConstraints > 0 ? Math.round((lifestylePlan.variableExpenses / cm.softConstraints) * 100) : 100}% of current). ${lifestylePlan.investments === 0 ? "Investment contributions pause entirely." : `Investments continue at ${formatDollars(lifestylePlan.investments)}/month.`}${shortfallNote(planShortfall(lifestylePlan))}${hasIncomeShock ? " Best if you expect to recover income within a few months." : ""}`,
    ),
  ];

  // ── Plan 2: Maximize Investment Discipline ──
  // Prefer lifestyle cuts (up to 60%, then deeper) and savings redirects before pausing investments.
  const investCuts = allocateCuts(amountNeeded, cm.softConstraints, cm.pausable, cm.redirectable, [
    { bucket: "variable", maxFraction: 0.6 },
    { bucket: "redirect" },
    { bucket: "variable", maxFraction: 1 },
    { bucket: "pause" },
  ]);
  const investPlan = toReallocation(investCuts);

  plans.push(
    buildPlan(
      "maximize_investments",
      hasIncomeShock ? "Medium-Term: Protect Investments" : "Maximize Investments",
      profile,
      stress,
      investPlan,
      `${hasIncomeShock ? `Over the ${durationLabel}, this plan ` : "This plan "}keeps your investments on track by cutting variable spending from ${formatDollars(cm.softConstraints)} to ${formatDollars(investPlan.variableExpenses)}/month${investCuts.redirectCut > 0 ? ` and redirecting ${formatDollars(investCuts.redirectCut)}/month from your savings goal` : ""}. Investments continue at ${formatDollars(investPlan.investments)}/month. Lifestyle impact is significant during the crisis.${shortfallNote(planShortfall(investPlan))}${hasIncomeShock ? " Best if you want to maintain long-term growth even during the disruption." : ""}`,
    ),
  );

  // ── Plan 3: Savings-goal priority OR fastest risk payoff ──
  // Protect savings contributions: pause investments and deepen variable cuts before redirecting.
  // Maximum Survival (no savings goal) may cut 100% of variable spend.
  const savingsCuts = allocateCuts(amountNeeded, cm.softConstraints, cm.pausable, cm.redirectable, hasSavingsGoal
    ? [
        { bucket: "pause" },
        { bucket: "variable", maxFraction: 0.4 },
        { bucket: "variable", maxFraction: 1 },
        { bucket: "redirect" },
      ]
    : [
        { bucket: "pause" },
        { bucket: "variable", maxFraction: 1 },
        { bucket: "redirect" },
      ]);
  const savingsPlan = toReallocation(savingsCuts);

  plans.push(
    buildPlan(
      "maximize_savings_goal",
      hasSavingsGoal
        ? (hasIncomeShock ? "Long-Term: Protect Savings Goal" : "Maximize Savings Goal")
        : (hasIncomeShock ? "Long-Term: Maximum Survival" : "Maximize Risk Payoff"),
      profile,
      stress,
      savingsPlan,
      hasSavingsGoal
        ? `${hasIncomeShock ? `For a sustained income loss (${durationLabel}+), this plan ` : "This plan "}keeps your savings goal "${profile.savingsGoal!.name}" on track by pausing ${formatDollars(savingsCuts.pauseCut)}/month in investments and cutting variable spending to ${formatDollars(savingsPlan.variableExpenses)}/month. Savings contributions continue at ${formatDollars(savingsPlan.savingsGoal)}/month.${shortfallNote(planShortfall(savingsPlan))}${hasIncomeShock ? " Best if you want to stay on track for your goal even through a tough period." : ""}`
        : `${hasIncomeShock ? `For a prolonged income loss (${durationLabel}+), this plan ` : "This plan "}makes the most aggressive cuts: variable spending down to ${formatDollars(savingsPlan.variableExpenses)}/month, investments paused by ${formatDollars(savingsCuts.pauseCut)}/month. Maximizes cash preservation and extends your runway as long as possible.${shortfallNote(planShortfall(savingsPlan))}${hasIncomeShock ? " Best if you need to stretch every dollar until you're back on your feet." : ""}`,
    ),
  );

  // ── Recommend: prefer plans that close the monthly expense gap, then goal weights ──
  const weightMap: Record<PlanType, number> = {
    maximize_lifestyle: weights.lifestyle,
    maximize_investments: weights.investmentDiscipline,
    maximize_savings_goal: weights.savingsGoal,
  };

  const anyFeasible = plans.some(p => planShortfall(p.monthlyReallocation) === 0);
  const topWeight = Math.max(...plans.map(p => weightMap[p.type] ?? 0));
  let bestScore = -Infinity;
  let bestPlanId = plans[0].id;
  for (const plan of plans) {
    const feasible = planShortfall(plan.monthlyReallocation) === 0;
    if (anyFeasible && !feasible) continue;
    const score = weightMap[plan.type] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestPlanId = plan.id;
    }
  }

  return plans.map(p => {
    const isRecommended = p.id === bestPlanId;
    if (!isRecommended) return { ...p, isRecommended: false, recommendationReason: undefined };

    const choseFeasibleOverHigherWeight =
      anyFeasible &&
      planShortfall(p.monthlyReallocation) === 0 &&
      (weightMap[p.type] ?? 0) < topWeight;

    return {
      ...p,
      isRecommended: true,
      recommendationReason: choseFeasibleOverHigherWeight
        ? "Recommended because it closes your monthly budget gap — higher-priority plans still leave a shortfall under this shock."
        : `Recommended based on your goal weights — your highest priority is ${
            p.type === "maximize_lifestyle" ? "maintaining your lifestyle"
            : p.type === "maximize_investments" ? "investment discipline"
            : hasSavingsGoal ? `reaching your savings goal "${profile.savingsGoal?.name}"` : "paying down risk quickly"
          }.`,
    };
  });
}
