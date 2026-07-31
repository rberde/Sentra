import type { PlaidAccount, SavingsGoal } from "@/lib/types";

/**
 * Split depository balances into checking vs savings.
 * The risk engine treats `cashBuffer` and `savingsGoal.currentBalance` as
 * disjoint buckets and sums them for liquidity — so the same Plaid savings
 * dollars must not appear in both.
 */
export function splitDepositoryBalances(
  accounts: Array<Pick<PlaidAccount, "type" | "balance">>,
): { checking: number; savings: number } {
  let checking = 0;
  let savings = 0;
  for (const account of accounts) {
    const balance = Number.isFinite(account.balance) ? account.balance : 0;
    // Preserve known Math.max(0) behavior for overdraft/negative balances.
    const nonNegative = Math.max(0, balance);
    if (account.type === "savings") savings += nonNegative;
    else if (account.type === "checking") checking += nonNegative;
  }
  return { checking, savings };
}

export function resolveCashBufferAndSavingsGoal(input: {
  checking: number;
  savings: number;
  existingSavingsGoal: SavingsGoal | null;
  /**
   * When true and no goal exists yet, auto-create a down-payment goal from
   * the savings balance (onboarding Plaid import).
   */
  createGoalFromSavings?: boolean;
  savingsAccountId?: string;
}): {
  cashBuffer: number;
  savingsGoal: SavingsGoal | null;
  createdSavingsGoal: boolean;
} {
  const { checking, savings, existingSavingsGoal, createGoalFromSavings = false, savingsAccountId } = input;

  if (existingSavingsGoal) {
    return {
      // Savings is tracked on the goal — keep cashBuffer as checking only.
      cashBuffer: checking,
      savingsGoal: {
        ...existingSavingsGoal,
        currentBalance: savings > 0 ? savings : existingSavingsGoal.currentBalance,
      },
      createdSavingsGoal: false,
    };
  }

  if (createGoalFromSavings && savings > 0) {
    return {
      cashBuffer: checking,
      savingsGoal: {
        name: "House Down Payment",
        targetAmount: 100000,
        targetDate: "2028-12-31",
        currentBalance: savings,
        monthlyContribution: 0,
        linkedAccountIds: savingsAccountId ? [savingsAccountId] : undefined,
      },
      createdSavingsGoal: true,
    };
  }

  // No savings goal: keep all depository liquidity in cashBuffer.
  return {
    cashBuffer: checking + savings,
    savingsGoal: null,
    createdSavingsGoal: false,
  };
}
