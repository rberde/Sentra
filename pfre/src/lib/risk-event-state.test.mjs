import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { removeRiskEventState } from "./risk-event-state.ts";

describe("removeRiskEventState", () => {
  const stressResult = {
    riskScoreBefore: 20,
    riskScoreAfter: 75,
    riskScoreDelta: 55,
    baselineMonthlyBurn: 3000,
    adjustedMonthlyBurn: 3000,
    adjustedIncome: 0,
    liquidityRunway: 2,
    crisisDurationMonths: 6,
    constraintMap: {
      hardConstraints: 2000,
      softConstraints: 1000,
      pausable: 500,
      redirectable: 200,
    },
    timeline: [],
  };

  const plans = [
    {
      id: "plan-a",
      name: "Cut lifestyle",
      type: "lifestyle",
      monthlyReallocation: {
        fixedExpenses: 2000,
        variableExpenses: 400,
        investments: 0,
        savings: 0,
        cashReserve: 0,
      },
    },
  ];

  it("clears stress, plans, and selection when removing the last risk event", () => {
    const next = removeRiskEventState(
      {
        riskEvents: [{ id: "evt-1", name: "Job loss", type: "income_shock", severity: 100, duration: 6 }],
        stressResult,
        rebalancingPlans: plans,
        selectedPlanId: "plan-a",
      },
      "evt-1"
    );

    assert.deepEqual(next.riskEvents, []);
    assert.equal(next.stressResult, null);
    assert.deepEqual(next.rebalancingPlans, []);
    assert.equal(next.selectedPlanId, null);
  });

  it("invalidates derived crisis state when a partial event set remains", () => {
    const remaining = {
      id: "evt-2",
      name: "Market shock",
      type: "market_shock",
      severity: 30,
      duration: 3,
    };

    const next = removeRiskEventState(
      {
        riskEvents: [
          { id: "evt-1", name: "Job loss", type: "income_shock", severity: 100, duration: 6 },
          remaining,
        ],
        stressResult,
        rebalancingPlans: plans,
        selectedPlanId: "plan-a",
      },
      "evt-1"
    );

    assert.deepEqual(next.riskEvents, [remaining]);
    assert.equal(next.stressResult, null);
    assert.deepEqual(next.rebalancingPlans, []);
    assert.equal(next.selectedPlanId, null);
  });

  it("leaves state unchanged when the event id is unknown", () => {
    const events = [{ id: "evt-1", name: "Job loss", type: "income_shock", severity: 100, duration: 6 }];
    const prev = {
      riskEvents: events,
      stressResult,
      rebalancingPlans: plans,
      selectedPlanId: "plan-a",
    };
    const next = removeRiskEventState(prev, "missing");

    assert.deepEqual(next, prev);
  });
});
