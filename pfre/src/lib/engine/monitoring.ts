type ReallocationBucket = "fixedExpenses" | "variableExpenses" | "investments";

type ReallocationLike = Partial<Record<ReallocationBucket, number>>;

const DRIFT_BUCKETS: Array<{ key: ReallocationBucket; name: string }> = [
  { key: "fixedExpenses", name: "Fixed" },
  { key: "variableExpenses", name: "Variable" },
  { key: "investments", name: "Investments" },
];

function bucketAmount(reallocation: ReallocationLike | undefined, bucket: ReallocationBucket): number {
  const amount = reallocation?.[bucket];
  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
}

function percentOfIncome(amount: number, income: number): number {
  return income > 0 ? Math.round((amount / income) * 100) : 0;
}

export function calculateSpendingUsage(
  actualSpending: number,
  reallocation: ReallocationLike | undefined,
) {
  const variableCap = bucketAmount(reallocation, "variableExpenses");
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;

  return { variableCap, percentUsed };
}

export function calculateAllocationDrift({
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
  reallocation: ReallocationLike | undefined;
}) {
  const actualDollarsByBucket: Record<ReallocationBucket, number> = {
    fixedExpenses: actualFixed,
    variableExpenses: actualVariable,
    investments: actualInvestment,
  };

  return DRIFT_BUCKETS.map(({ key, name }) => {
    const actualDollars = actualDollarsByBucket[key];
    const plannedDollars = bucketAmount(reallocation, key);
    const actual = percentOfIncome(actualDollars, income);
    const planned = percentOfIncome(plannedDollars, income);

    return {
      name,
      actual,
      planned,
      drift: Math.abs(actual - planned),
      actualDollars,
      plannedDollars,
    };
  });
}
