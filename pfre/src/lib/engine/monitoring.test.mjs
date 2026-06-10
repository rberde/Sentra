import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateAllocationDrift, evaluateSpending } from "./monitoring.ts";

describe("evaluateSpending", () => {
  it("treats legacy AI-generated spending thresholds as dollar caps", () => {
    const result = evaluateSpending(2_000, 1_800, {
      threshold: 1_800,
      aiGenerated: true,
    });

    assert.equal(result.variableCap, 1_800);
    assert.equal(result.thresholdAmount, 1_800);
    assert.equal(result.thresholdPercent, 100);
    assert.equal(result.percentUsed, 111);
    assert.equal(result.alert, true);
  });

  it("keeps non-AI spending thresholds as percentages of the plan cap", () => {
    const result = evaluateSpending(2_100, 1_800, {
      threshold: 120,
      aiGenerated: false,
    });

    assert.equal(result.thresholdAmount, 2_160);
    assert.equal(result.thresholdPercent, 120);
    assert.equal(result.percentUsed, 117);
    assert.equal(result.alert, false);
  });
});

describe("evaluateAllocationDrift", () => {
  it("compares actual and planned dollar amounts for drift", () => {
    const result = evaluateAllocationDrift(
      {
        fixedExpenses: 2_500,
        variableExpenses: 2_000,
        investments: 500,
      },
      {
        fixedExpenses: 2_500,
        variableExpenses: 1_800,
        investments: 500,
      },
      10,
    );

    const variable = result.categories.find(category => category.key === "variableExpenses");

    assert.equal(variable?.actual, 2_000);
    assert.equal(variable?.planned, 1_800);
    assert.equal(variable?.driftPct, 11);
    assert.equal(result.overallDrift, 11);
    assert.equal(result.alert, true);
  });
});
