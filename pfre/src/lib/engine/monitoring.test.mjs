import assert from "node:assert/strict";
import test from "node:test";

import {
  amountFromReallocation,
  daysSinceIso,
  driftPercentPoints,
  percentUsed,
  percentageOfIncome,
  planCheckinReferenceIso,
} from "./monitoring.ts";

test("reads rebalancing budgets as dollar amounts", () => {
  const reallocation = {
    fixedExpenses: 2_400,
    variableExpenses: 1_800,
    investments: 600,
  };

  assert.equal(amountFromReallocation(reallocation, "variableExpenses"), 1_800);
  assert.equal(percentUsed(2_250, amountFromReallocation(reallocation, "variableExpenses")), 125);
});

test("compares allocation drift as percentage points of income", () => {
  assert.equal(percentageOfIncome(2_400, 6_000), 40);
  assert.equal(percentageOfIncome(1_800, 6_000), 30);
  assert.equal(driftPercentPoints(2_100, 1_800, 6_000), 5);
});

test("uses plan selection metadata for scheduled check-ins before creation fallback", () => {
  const state = {
    behavioralProfile: {
      planSelections: [
        { planType: "maximize_lifestyle", date: "2026-04-01T00:00:00.000Z" },
        { planType: "maximize_investments", date: "2026-04-10T00:00:00.000Z" },
      ],
    },
    notifications: [
      { type: "scheduled_checkin", createdAt: "2026-03-01T00:00:00.000Z" },
    ],
  };
  const activePlan = {
    type: "maximize_lifestyle",
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  const reference = planCheckinReferenceIso(activePlan, state);
  assert.equal(reference, "2026-04-01T00:00:00.000Z");
  assert.equal(daysSinceIso(reference, new Date("2026-04-16T00:00:00.000Z").getTime()), 15);
});
