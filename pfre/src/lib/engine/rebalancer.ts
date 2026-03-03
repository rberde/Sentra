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
  const timelineToResolve = freeablePerMonth > 0 && totalPressure > 0
    ? Math.ceil(totalPressure / freeablePerMonth)
    : monthlyGap > 0 ? stress.crisisDurationMonths : 0;

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
  const savingsBalance = profile.savingsGoal?.currentBalance ?? 0;

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
  const isUnknownDuration = stress.crisisDurationMonths <= 6 && rawNeeded > 0;

  const formatDollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const hasIncomeShock = stress.adjustedIncome < profile.monthlyIncome;
  const remainingGap = Math.max(0, rawNeeded - amountNeeded);
  const durationLabel = stress.crisisDurationMonths <= 6
    ? `${stress.crisisDurationMonths}-month planning horizon`
    : `${stress.crisisDurationMonths} months`;
  const cashRunwayNote = remainingGap > 0 && profile.cashBuffer > 0
    ? ` Even after cuts, there's a ${formatDollars(remainingGap)}/mo shortfall that draws from your cash reserve (${Math.round(profile.cashBuffer / remainingGap)} months of runway).`
    : "";

  // ── Plan 1: Maximize Lifestyle ──
  const lifestylePausable = Math.min(cm.pausable, amountNeeded);
  const lifestyleRedirectable = Math.min(cm.redirectable, Math.max(0, amountNeeded - lifestylePausable));
  const lifestyleVariableCut = Math.max(0, amountNeeded - lifestylePausable - lifestyleRedirectable);

  const lifestylePlan: BucketReallocation = {
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - lifestyleVariableCut),
    investments: Math.max(0, cm.pausable - lifestylePausable),
    savingsGoal: Math.max(0, cm.redirectable - lifestyleRedirectable),
    cashBuffer: 0,
  };

  const plans: RebalancingPlan[] = [
    buildPlan(
      "maximize_lifestyle",
      hasIncomeShock ? "Short-Term: Preserve Lifestyle" : "Maximize Lifestyle",
      profile,
      stress,
      lifestylePlan,
      `${hasIncomeShock ? `During your income disruption (${durationLabel}), this plan ` : "This plan "}keeps your lifestyle as close to normal as possible by pausing ${formatDollars(lifestylePausable)}/month in investment contributions${lifestyleRedirectable > 0 ? ` and redirecting ${formatDollars(lifestyleRedirectable)}/month from your savings goal` : ""}. Variable spending stays at ${formatDollars(lifestylePlan.variableExpenses)}/month (${cm.softConstraints > 0 ? Math.round((lifestylePlan.variableExpenses / cm.softConstraints) * 100) : 100}% of current). ${lifestylePlan.investments === 0 ? "Investment contributions pause entirely." : `Investments continue at ${formatDollars(lifestylePlan.investments)}/month.`}${cashRunwayNote}${hasIncomeShock ? " Best if you expect to recover income within a few months." : ""}`,
    ),
  ];

  // ── Plan 2: Maximize Investment Discipline ──
  const investVariableCut = Math.min(cm.softConstraints * 0.6, amountNeeded);
  const investRedirectable = Math.min(cm.redirectable, Math.max(0, amountNeeded - investVariableCut));
  const investPausable = Math.max(0, amountNeeded - investVariableCut - investRedirectable);

  const investPlan: BucketReallocation = {
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - investVariableCut),
    investments: Math.max(0, cm.pausable - investPausable),
    savingsGoal: Math.max(0, cm.redirectable - investRedirectable),
    cashBuffer: 0,
  };

  plans.push(
    buildPlan(
      "maximize_investments",
      hasIncomeShock ? "Medium-Term: Protect Investments" : "Maximize Investments",
      profile,
      stress,
      investPlan,
      `${hasIncomeShock ? `Over the ${durationLabel}, this plan ` : "This plan "}keeps your investments on track by cutting variable spending from ${formatDollars(cm.softConstraints)} to ${formatDollars(investPlan.variableExpenses)}/month${investRedirectable > 0 ? ` and redirecting ${formatDollars(investRedirectable)}/month from your savings goal` : ""}. Investments continue at ${formatDollars(investPlan.investments)}/month. Lifestyle impact is significant during the crisis.${cashRunwayNote}${hasIncomeShock ? " Best if you want to maintain long-term growth even during the disruption." : ""}`,
    ),
  );

  // ── Plan 3: Savings-goal priority OR fastest risk payoff ──
  const savingsPausable = Math.min(cm.pausable, amountNeeded);
  const savingsVariableCut = hasSavingsGoal
    ? Math.min(cm.softConstraints * 0.4, Math.max(0, amountNeeded - savingsPausable))
    : Math.min(cm.softConstraints * 0.8, Math.max(0, amountNeeded - savingsPausable));
  const savingsRedirectable = Math.max(0, amountNeeded - savingsPausable - savingsVariableCut);

  const savingsPlan: BucketReallocation = {
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - savingsVariableCut),
    investments: Math.max(0, cm.pausable - savingsPausable),
    savingsGoal: Math.max(0, cm.redirectable - savingsRedirectable),
    cashBuffer: 0,
  };

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
        ? `${hasIncomeShock ? `For a sustained income loss (${durationLabel}+), this plan ` : "This plan "}keeps your savings goal "${profile.savingsGoal!.name}" on track by pausing ${formatDollars(savingsPausable)}/month in investments and cutting variable spending to ${formatDollars(savingsPlan.variableExpenses)}/month. Savings contributions continue at ${formatDollars(savingsPlan.savingsGoal)}/month.${cashRunwayNote}${hasIncomeShock ? " Best if you want to stay on track for your goal even through a tough period." : ""}`
        : `${hasIncomeShock ? `For a prolonged income loss (${durationLabel}+), this plan ` : "This plan "}makes the most aggressive cuts: variable spending down to ${formatDollars(savingsPlan.variableExpenses)}/month, investments paused by ${formatDollars(savingsPausable)}/month. Maximizes cash preservation and extends your runway as long as possible.${cashRunwayNote}${hasIncomeShock ? " Best if you need to stretch every dollar until you're back on your feet." : ""}`,
    ),
  );

  // ── Recommend best plan based on goal weights ──
  const weightMap: Record<PlanType, number> = {
    maximize_lifestyle: weights.lifestyle,
    maximize_investments: weights.investmentDiscipline,
    maximize_savings_goal: weights.savingsGoal,
  };

  let bestScore = -1;
  let bestPlanId = plans[0].id;
  for (const plan of plans) {
    const score = weightMap[plan.type] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestPlanId = plan.id;
    }
  }

  return plans.map(p => ({
    ...p,
    isRecommended: p.id === bestPlanId,
    recommendationReason: p.id === bestPlanId
      ? `Recommended based on your goal weights — your highest priority is ${
          p.type === "maximize_lifestyle" ? "maintaining your lifestyle"
          : p.type === "maximize_investments" ? "investment discipline"
          : hasSavingsGoal ? `reaching your savings goal "${profile.savingsGoal?.name}"` : "paying down risk quickly"
        }.`
      : undefined,
  }));
}
