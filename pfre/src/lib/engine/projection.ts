import type { BucketReallocation, MonthProjection } from "@/lib/types";

/**
 * Project bucket balances forward under a fixed monthly reallocation.
 *
 * Cash is allowed to go negative so unpaid shortfalls remain visible in
 * `cashBuffer` and `netPosition`. Clamping cash to zero after funding
 * savings/investments would create phantom net worth (contributions appear
 * funded with no corresponding cash draw once the buffer is exhausted).
 */
export function projectMonth(
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

    cash +=
      monthlyIncome -
      totalExpenses -
      reallocation.investments -
      reallocation.savingsGoal +
      reallocation.cashBuffer;
    savings += reallocation.savingsGoal;
    investments = investments * (1 + investmentGrowthRate) + reallocation.investments;

    // Do not clamp cash — negative cash represents an unpaid monthly shortfall.
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
