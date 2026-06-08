import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateDollarDrift,
  daysSinceTimestamp,
  evaluateSpendingBudget,
  getPlanActivationTimestamp,
  normalizeSpendingThresholdPct,
} from "./monitoring.ts";

describe("monitoring calculations", () => {
  it("alerts when actual variable spending exceeds the active plan's dollar budget", () => {
    const result = evaluateSpendingBudget(1_400, 1_200, 100);

    assert.equal(result.planBudget, 1_200);
    assert.equal(result.percentUsed, 117);
    assert.equal(result.thresholdPct, 100);
    assert.equal(result.alert, true);
  });

  it("normalizes legacy AI dollar thresholds back to a percentage", () => {
    assert.equal(normalizeSpendingThresholdPct(1_200), 100);

    const result = evaluateSpendingBudget(1_400, 1_200, 1_200);
    assert.equal(result.thresholdPct, 100);
    assert.equal(result.alert, true);
  });

  it("calculates drift against planned dollar amounts", () => {
    assert.deepEqual(calculateDollarDrift("Variable", 1_200, 1_200), {
      name: "Variable",
      actual: 1_200,
      planned: 1_200,
      driftPct: 0,
    });

    assert.deepEqual(calculateDollarDrift("Variable", 1_500, 1_200), {
      name: "Variable",
      actual: 1_500,
      planned: 1_200,
      driftPct: 25,
    });
  });

  it("uses a stable plan activation timestamp instead of rolling sync time", () => {
    const activation = "2026-05-25T11:00:00.000Z";
    const sync = "2026-06-08T11:00:00.000Z";
    const timestamp = getPlanActivationTimestamp(
      { id: "plan_1", type: "maximize_lifestyle", activatedAt: activation },
      { lastSyncedAt: sync },
    );

    assert.equal(timestamp, activation);
    assert.equal(daysSinceTimestamp(timestamp, new Date(sync).getTime()), 14);
  });

  it("falls back to the latest matching plan selection for older synced states", () => {
    const timestamp = getPlanActivationTimestamp(
      { id: "plan_1", type: "maximize_investments" },
      {
        lastSyncedAt: "2026-06-08T11:00:00.000Z",
        behavioralProfile: {
          planSelections: [
            { planType: "maximize_lifestyle", date: "2026-05-01T11:00:00.000Z" },
            { planType: "maximize_investments", date: "2026-05-20T11:00:00.000Z" },
          ],
        },
      },
    );

    assert.equal(timestamp, "2026-05-20T11:00:00.000Z");
  });
});
