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
  const adjustedIncome = Math.max(0, profile.monthlyIncome - (stress.adjustedMonthlyBurn - stress.baselineMonthlyBurn));
  const effectiveIncome = Math.max(0, adjustedIncome > profile.monthlyIncome ? profile.monthlyIncome : adjustedIncome);

  const freeablePerMonth = (
    stress.constraintMap.softConstraints - reallocation.variableExpenses +
    stress.constraintMap.pausable - reallocation.investments +
    stress.constraintMap.redirectable - reallocation.savingsGoal
  );
  const timelineToResolve = freeablePerMonth > 0 && stress.additionalExpense > 0
    ? Math.ceil(stress.additionalExpense / freeablePerMonth)
    : 0;

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

  const amountNeeded = Math.max(stress.adjustedMonthlyBurn - Math.max(0, profile.monthlyIncome - (stress.adjustedMonthlyBurn - stress.baselineMonthlyBurn)), 0);

  const formatDollars = (n: number) => `$${Math.round(n).toLocaleString()}`;

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
      "Maximize Lifestyle",
      profile,
      stress,
      lifestylePlan,
      `To keep your lifestyle as close to normal as possible, we would pause ${formatDollars(lifestylePausable)}/month in investment contributions${lifestyleRedirectable > 0 ? ` and redirect ${formatDollars(lifestyleRedirectable)}/month from your savings goal` : ""} to cover expenses. Your variable spending stays at ${formatDollars(lifestylePlan.variableExpenses)}/month (${cm.softConstraints > 0 ? Math.round((lifestylePlan.variableExpenses / cm.softConstraints) * 100) : 100}% of current). ${lifestylePlan.investments === 0 ? "Investment contributions pause entirely." : `Investments continue at ${formatDollars(lifestylePlan.investments)}/month.`}`,
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
      "Maximize Investments",
      profile,
      stress,
      investPlan,
      `To keep your investments on track, we would cut variable spending from ${formatDollars(cm.softConstraints)} to ${formatDollars(investPlan.variableExpenses)}/month${investRedirectable > 0 ? ` and redirect ${formatDollars(investRedirectable)}/month from your savings goal` : ""}. Investments continue at ${formatDollars(investPlan.investments)}/month. Lifestyle impact is significant during the crisis period.`,
    ),
  );

  // ── Plan 3: Savings-goal priority OR fastest risk payoff if no savings goal ──
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
      hasSavingsGoal ? "Maximize Savings Goal" : "Maximize Risk Payoff",
      profile,
      stress,
      savingsPlan,
      hasSavingsGoal
        ? `To keep your savings goal "${profile.savingsGoal!.name}" on track, we would pause ${formatDollars(savingsPausable)}/month in investment contributions and cut variable spending to ${formatDollars(savingsPlan.variableExpenses)}/month. Savings contributions continue at ${formatDollars(savingsPlan.savingsGoal)}/month. ${savingsPlan.investments === 0 ? "Investment contributions pause entirely." : `Investments continue at ${formatDollars(savingsPlan.investments)}/month.`}`
        : `To pay off risk as fast as possible, we prioritize aggressive cuts to variable spending (down to ${formatDollars(savingsPlan.variableExpenses)}/month) and pause as much investing as needed (${formatDollars(savingsPausable)}/month). This option maximizes short-term stability and speeds up expense resolution.`,
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
          : `reaching your savings goal "${profile.savingsGoal?.name}"`
        }.`
      : undefined,
  }));
}
