import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysSincePlanStart, isCheckinDue, resolvePlanStartAt } from "./checkin.ts";

describe("resolvePlanStartAt", () => {
  it("prefers plan createdAt over lastSyncedAt", () => {
    assert.equal(
      resolvePlanStartAt("2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z"),
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("falls back to lastSyncedAt when createdAt is missing", () => {
    assert.equal(
      resolvePlanStartAt(undefined, "2026-06-01T00:00:00.000Z"),
      "2026-06-01T00:00:00.000Z",
    );
  });

  it("returns null instead of inventing 'now'", () => {
    assert.equal(resolvePlanStartAt(undefined, undefined), null);
    assert.equal(resolvePlanStartAt("", "  "), null);
  });
});

describe("scheduled check-in due detection", () => {
  const now = Date.parse("2026-07-25T12:00:00.000Z");

  it("does not mark check-in due when start would have been 'now' (regression)", () => {
    // Pre-fix evaluate fell back to new Date(), so daysSince was always 0.
    const result = isCheckinDue(undefined, undefined, 30, now);
    assert.equal(result.due, false);
    assert.equal(result.daysSince, null);
  });

  it("marks check-in due once intervalDays have elapsed since plan createdAt", () => {
    const createdAt = "2026-06-20T12:00:00.000Z"; // 35 days earlier
    assert.equal(daysSincePlanStart(createdAt, undefined, now), 35);
    const result = isCheckinDue(createdAt, "2026-07-24T12:00:00.000Z", 30, now);
    assert.equal(result.due, true);
    assert.equal(result.daysSince, 35);
  });

  it("uses lastSyncedAt for legacy plans missing createdAt", () => {
    const lastSyncedAt = "2026-06-10T12:00:00.000Z"; // 45 days earlier
    const result = isCheckinDue(undefined, lastSyncedAt, 30, now);
    assert.equal(result.due, true);
    assert.equal(result.daysSince, 45);
  });

  it("keeps check-in not due before the interval elapses", () => {
    const createdAt = "2026-07-10T12:00:00.000Z"; // 15 days earlier
    const result = isCheckinDue(createdAt, undefined, 30, now);
    assert.equal(result.due, false);
    assert.equal(result.daysSince, 15);
  });
});
