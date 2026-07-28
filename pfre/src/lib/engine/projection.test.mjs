import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectMonth } from "./projection.ts";

describe("projectMonth cash shortfall accounting", () => {
  it("does not invent net worth when savings continue after cash is exhausted", () => {
    const startCash = 4000;
    const startSavings = 10000;
    const startInvestments = 100000;
    const income = 0;
    const months = 12;

    const keepSaving = projectMonth(
      startCash,
      startSavings,
      startInvestments,
      income,
      {
        fixedExpenses: 3500,
        variableExpenses: 0,
        investments: 0,
        savingsGoal: 500,
        cashBuffer: 0,
      },
      months,
      0,
    );

    const pauseSaving = projectMonth(
      startCash,
      startSavings,
      startInvestments,
      income,
      {
        fixedExpenses: 3500,
        variableExpenses: 0,
        investments: 0,
        savingsGoal: 0,
        cashBuffer: 0,
      },
      months,
      0,
    );

    // Continuing to "save" while insolvent is only a balance-sheet transfer.
    // Both paths must report the same net position — never a phantom gain.
    assert.equal(keepSaving.netPosition, pauseSaving.netPosition);
    assert.equal(keepSaving.savingsBalance - pauseSaving.savingsBalance, 6000);
    assert.equal(keepSaving.cashBuffer - pauseSaving.cashBuffer, -6000);
    assert.ok(keepSaving.cashBuffer < 0, "unpaid shortfall must remain visible as negative cash");
  });

  it("preserves positive cash when income covers outflows", () => {
    const result = projectMonth(
      2000,
      5000,
      50000,
      5000,
      {
        fixedExpenses: 2000,
        variableExpenses: 1000,
        investments: 500,
        savingsGoal: 500,
        cashBuffer: 0,
      },
      6,
      0,
    );

    // 2000 + 6 * (5000 - 2000 - 1000 - 500 - 500) = 2000 + 6000 = 8000
    assert.equal(result.cashBuffer, 8000);
    assert.equal(result.savingsBalance, 8000);
    assert.equal(result.investmentValue, 53000);
    assert.equal(result.netPosition, 8000 + 8000 + 53000);
  });
});
