import type { BucketReallocation } from "@/lib/types";

type RuleLike = {
  threshold?: unknown;
  aiGenerated?: unknown;
};

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  actualAmount: number;
  plannedAmount: number;
  drift: number;
}

export function monthlyBudgetAmount(
  reallocation: Partial<Record<keyof BucketReallocation, number>> | undefined,
  bucket: keyof BucketReallocation,
): number {
  const amount = reallocation?.[bucket];
  return typeof amount === "number" && Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

export function spendingThresholdPercent(rule: Partial<RuleLike> | undefined, planBudget: number): number {
  const threshold = typeof rule?.threshold === "number" && Number.isFinite(rule.threshold)
    ? rule.threshold
    : 100;

  // Older AI-generated rules stored the dollar budget in the percent field.
  // If the value still matches the selected plan budget, treat it as 100%.
  if (rule?.aiGenerated === true && planBudget > 0 && Math.round(threshold) === Math.round(planBudget)) {
    return 100;
  }

  return threshold;
}

export function buildAllocationDriftCategories({
  income,
  actualFixed,
  actualVariable,
  actualInvestment,
  reallocation,
}: {
  income: number;
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: Partial<Record<keyof BucketReallocation, number>>;
}): DriftCategory[] {
  const toPct = (amount: number) => income > 0 ? Math.round((amount / income) * 100) : 0;

  const categories = [
    {
      name: "Fixed",
      actualAmount: actualFixed,
      plannedAmount: monthlyBudgetAmount(reallocation, "fixedExpenses"),
    },
    {
      name: "Variable",
      actualAmount: actualVariable,
      plannedAmount: monthlyBudgetAmount(reallocation, "variableExpenses"),
    },
    {
      name: "Investments",
      actualAmount: actualInvestment,
      plannedAmount: monthlyBudgetAmount(reallocation, "investments"),
    },
  ];

  return categories.map(category => {
    const actual = toPct(category.actualAmount);
    const planned = toPct(category.plannedAmount);
    return {
      ...category,
      actual,
      planned,
      drift: Math.abs(actual - planned),
    };
  });
}
