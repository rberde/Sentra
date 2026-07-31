import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCashBufferAndSavingsGoal,
  splitDepositoryBalances,
} from "./plaid-balances.ts";

describe("splitDepositoryBalances", () => {
  it("separates checking and savings without double-counting", () => {
    const split = splitDepositoryBalances([
      { type: "checking", balance: 5000 },
      { type: "savings", balance: 20000 },
      { type: "investment", balance: 50000 },
    ]);
    assert.equal(split.checking, 5000);
    assert.equal(split.savings, 20000);
  });
});

describe("resolveCashBufferAndSavingsGoal", () => {
  it("does not put the same savings dollars in cashBuffer and savingsGoal", () => {
    const resolved = resolveCashBufferAndSavingsGoal({
      checking: 5000,
      savings: 20000,
      existingSavingsGoal: null,
      createGoalFromSavings: true,
      savingsAccountId: "sav_1",
    });

    assert.equal(resolved.cashBuffer, 5000);
    assert.equal(resolved.savingsGoal?.currentBalance, 20000);
    assert.equal(resolved.createdSavingsGoal, true);

    // Engine liquidity is cash + savings goal — must equal real depository total.
    const liquid = resolved.cashBuffer + (resolved.savingsGoal?.currentBalance ?? 0);
    assert.equal(liquid, 25000);
  });

  it("keeps checking+savings in cashBuffer when no savings goal is created", () => {
    const resolved = resolveCashBufferAndSavingsGoal({
      checking: 5000,
      savings: 20000,
      existingSavingsGoal: null,
      createGoalFromSavings: false,
    });

    assert.equal(resolved.cashBuffer, 25000);
    assert.equal(resolved.savingsGoal, null);
  });

  it("on refresh with an existing goal, uses checking-only cashBuffer", () => {
    const resolved = resolveCashBufferAndSavingsGoal({
      checking: 4800,
      savings: 21000,
      existingSavingsGoal: {
        name: "House Down Payment",
        targetAmount: 100000,
        targetDate: "2028-12-31",
        currentBalance: 20000,
        monthlyContribution: 500,
      },
      createGoalFromSavings: false,
    });

    assert.equal(resolved.cashBuffer, 4800);
    assert.equal(resolved.savingsGoal?.currentBalance, 21000);
    assert.equal(resolved.cashBuffer + resolved.savingsGoal.currentBalance, 25800);
  });
});
