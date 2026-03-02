import type {
  UserProfile,
  RiskEvent,
  CompoundRiskScenario,
  StressResult,
  ConstraintMap,
  MonthProjection,
} from "@/lib/types";

export function normalizeWeights(weights: { lifestyle: number; savingsGoal: number; investmentDiscipline: number }) {
  const total = weights.lifestyle + weights.savingsGoal + weights.investmentDiscipline;
  if (total === 0) return { lifestyle: 1 / 3, savingsGoal: 1 / 3, investmentDiscipline: 1 / 3 };
  return {
    lifestyle: weights.lifestyle / total,
    savingsGoal: weights.savingsGoal / total,
    investmentDiscipline: weights.investmentDiscipline / total,
  };
}

function sumExpenses(expenses: { amount: number }[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function calculateBaselineRisk(profile: UserProfile): number {
  const totalFixedExpenses = sumExpenses(profile.fixedExpenses);
  const totalVariableExpenses = sumExpenses(profile.variableExpenses);
  const monthlyBurn = totalFixedExpenses + totalVariableExpenses;
  const savingsBalance = profile.savingsGoal?.currentBalance ?? 0;
  const liquidAssets = profile.cashBuffer + savingsBalance;
  const runwayMonths = monthlyBurn > 0 ? liquidAssets / monthlyBurn : 99;

  const monthlyContrib = profile.investments.monthlyContribution + (profile.savingsGoal?.monthlyContribution ?? 0);
  const savingsRate = profile.monthlyIncome > 0 ? monthlyContrib / profile.monthlyIncome : 0;

  // Risk score 0-100: lower is better
  // 60% runway, 40% savings rate
  const runwayScore = Math.min(runwayMonths / 12, 1) * 60;
  const savingsScore = Math.min(savingsRate / 0.3, 1) * 40;

  return Math.round(100 - (runwayScore + savingsScore));
}

export function identifyConstraints(profile: UserProfile): ConstraintMap {
  const hardConstraints = sumExpenses(profile.fixedExpenses);
  const softConstraints = sumExpenses(profile.variableExpenses);
  const pausable = profile.investments.monthlyContribution;
  const redirectable = profile.savingsGoal?.monthlyContribution ?? 0;
  const savingsBalance = profile.savingsGoal?.currentBalance ?? 0;
  const availableLiquidity = profile.cashBuffer + savingsBalance;

  return {
    hardConstraints,
    softConstraints,
    pausable,
    redirectable,
    availableLiquidity,
  };
}

function applyIncomeShock(profile: UserProfile, event: RiskEvent): { incomeReduction: number } {
  const reduction = (event.severity / 100) * profile.monthlyIncome;
  return { incomeReduction: reduction };
}

function applyExpenseShock(event: RiskEvent): { additionalMonthlyExpense: number; lumpSum: number } {
  return {
    additionalMonthlyExpense: event.lumpSum && event.duration > 0 ? event.lumpSum / event.duration : 0,
    lumpSum: event.lumpSum ?? 0,
  };
}

function applyMarketShock(profile: UserProfile, event: RiskEvent): { portfolioLoss: number } {
  const loss = (event.severity / 100) * profile.investments.totalValue;
  return { portfolioLoss: loss };
}

function applyStructuralDrift(profile: UserProfile, event: RiskEvent): { monthlyExpenseIncrease: number } {
  const increase = (event.severity / 100) * sumExpenses(profile.variableExpenses);
  return { monthlyExpenseIncrease: increase };
}

export function simulateRiskBucket(
  profile: UserProfile,
  scenario: CompoundRiskScenario,
): StressResult {
  const constraints = identifyConstraints(profile);
  const baselineBurn = constraints.hardConstraints + constraints.softConstraints;
  const baselineRisk = calculateBaselineRisk(profile);

  let incomeReduction = 0;
  let additionalMonthlyExpense = 0;
  let totalLumpSum = 0;
  let portfolioLoss = 0;
  let monthlyExpenseIncrease = 0;

  for (const event of scenario.events) {
    switch (event.type) {
      case "income_shock": {
        const result = applyIncomeShock(profile, event);
        incomeReduction += result.incomeReduction;
        break;
      }
      case "expense_shock": {
        const result = applyExpenseShock(event);
        additionalMonthlyExpense += result.additionalMonthlyExpense;
        totalLumpSum += result.lumpSum;
        break;
      }
      case "market_shock": {
        const result = applyMarketShock(profile, event);
        portfolioLoss += result.portfolioLoss;
        break;
      }
      case "structural_drift": {
        const result = applyStructuralDrift(profile, event);
        monthlyExpenseIncrease += result.monthlyExpenseIncrease;
        break;
      }
    }
  }

  const adjustedIncome = Math.max(0, profile.monthlyIncome - incomeReduction);
  const adjustedBurn = baselineBurn + additionalMonthlyExpense + monthlyExpenseIncrease;
  const monthlyDeficit = adjustedBurn - adjustedIncome;
  const stressedPortfolio = Math.max(0, profile.investments.totalValue - portfolioLoss);

  let liquidityPool = constraints.availableLiquidity;
  if (totalLumpSum > 0) {
    liquidityPool = Math.max(0, liquidityPool - totalLumpSum);
  }

  const liquidityRunway = monthlyDeficit > 0 ? liquidityPool / monthlyDeficit : 99;

  const savingsBalance = profile.savingsGoal?.currentBalance ?? 0;
  const timeline: MonthProjection[] = [];
  let cashBuf = profile.cashBuffer;
  let savBal = savingsBalance;
  let invVal = stressedPortfolio;
  let cumExpenses = 0;

  for (let m = 1; m <= 24; m++) {
    const deficit = adjustedBurn - adjustedIncome;
    cumExpenses += adjustedBurn;

    if (deficit > 0) {
      if (cashBuf >= deficit) {
        cashBuf -= deficit;
      } else {
        const remainder = deficit - cashBuf;
        cashBuf = 0;
        savBal = Math.max(0, savBal - remainder);
      }
    } else {
      cashBuf += Math.abs(deficit) * 0.5;
      savBal += Math.abs(deficit) * 0.5;
    }

    const hasMarketShock = scenario.events.some(e => e.type === "market_shock");
    if (!hasMarketShock) {
      invVal *= 1.005;
    }

    timeline.push({
      month: m,
      cashBuffer: Math.round(cashBuf),
      savingsBalance: Math.round(savBal),
      investmentValue: Math.round(invVal),
      cumulativeExpenses: Math.round(cumExpenses),
      netPosition: Math.round(cashBuf + savBal + invVal - cumExpenses),
    });
  }

  const stressedProfile: UserProfile = {
    ...profile,
    cashBuffer: liquidityPool,
    investments: { ...profile.investments, totalValue: stressedPortfolio },
    monthlyIncome: adjustedIncome,
  };
  const stressedRisk = calculateBaselineRisk(stressedProfile);

  const maxDuration = Math.max(...scenario.events.map(e => e.duration > 0 ? e.duration : 12));

  return {
    baselineMonthlyBurn: baselineBurn,
    adjustedMonthlyBurn: adjustedBurn,
    liquidityRunway: Math.round(liquidityRunway * 10) / 10,
    portfolioStressValue: stressedPortfolio,
    riskScoreBefore: baselineRisk,
    riskScoreAfter: stressedRisk,
    riskScoreDelta: stressedRisk - baselineRisk,
    constraintMap: constraints,
    depletionTimeline: timeline,
    additionalExpense: totalLumpSum + additionalMonthlyExpense * maxDuration,
  };
}
