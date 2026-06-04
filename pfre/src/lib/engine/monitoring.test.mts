import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAllocationDrift,
  calculateSpendingUsage,
} from "./monitoring.ts";
import { sanitizeServerState } from "../server-state.ts";

test("spending usage treats plan reallocation as monthly dollars", () => {
  const usage = calculateSpendingUsage(
    1700,
    { variableExpenses: 1500 },
    100,
  );

  assert.equal(usage.variableCap, 1500);
  assert.equal(usage.percentUsed, 113);
  assert.equal(usage.alert, true);
});

test("spending threshold remains a percentage of the plan budget", () => {
  const usage = calculateSpendingUsage(
    1700,
    { variableExpenses: 1500 },
    120,
  );

  assert.equal(usage.threshold, 120);
  assert.equal(usage.alert, false);
});

test("allocation drift compares planned and actual percentages from dollar buckets", () => {
  const categories = calculateAllocationDrift({
    income: 5000,
    actualFixed: 2000,
    actualVariable: 1700,
    actualInvestment: 500,
    reallocation: {
      fixedExpenses: 2000,
      variableExpenses: 1500,
      investments: 500,
    },
  });

  assert.deepEqual(
    categories.map(category => ({
      name: category.name,
      actualPct: category.actualPct,
      plannedPct: category.plannedPct,
      driftPct: category.driftPct,
    })),
    [
      { name: "Fixed Expenses", actualPct: 40, plannedPct: 40, driftPct: 0 },
      { name: "Variable Expenses", actualPct: 34, plannedPct: 30, driftPct: 4 },
      { name: "Investments", actualPct: 10, plannedPct: 10, driftPct: 0 },
    ],
  );
});

test("server state sanitization removes Plaid tokens and chat history", () => {
  const sanitized = sanitizeServerState({
    profile: { name: "Ada" },
    plaidAccessToken: "access-sandbox-secret",
    chatHistory: [{ role: "user", content: "private" }],
    lastSyncedAt: "2026-06-04T11:00:00.000Z",
  });

  assert.deepEqual(sanitized, {
    profile: { name: "Ada" },
    lastSyncedAt: "2026-06-04T11:00:00.000Z",
  });
});
