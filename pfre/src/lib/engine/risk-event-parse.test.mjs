import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyFollowupToEvent,
  suggestEventFromAnswers,
} from "./risk-event-parse.ts";

const profile = {
  monthlyIncome: 6000,
  investments: { totalValue: 200000 },
};

describe("suggestEventFromAnswers market_shock", () => {
  it("converts dollar portfolio losses to severity instead of defaulting to 30%", () => {
    const event = suggestEventFromAnswers(
      "market_shock",
      ["I lost about $10,000", "within a year"],
      profile,
    );

    // $10,000 / $200,000 = 5% (not the old default 30%)
    assert.equal(event.severity, 5);
    // "within a year" has no numeric duration token → unknown → 6-month default
    assert.equal(event.duration, 6);
  });

  it("still accepts explicit percent answers", () => {
    const event = suggestEventFromAnswers(
      "market_shock",
      ["down about 40%", "6 months"],
      profile,
    );
    assert.equal(event.severity, 40);
    assert.equal(event.duration, 6);
  });

  it("defaults to 30% only when neither percent nor dollars are present", () => {
    const event = suggestEventFromAnswers(
      "market_shock",
      ["pretty bad", "not sure"],
      profile,
    );
    assert.equal(event.severity, 30);
    assert.equal(event.duration, 6);
  });
});

describe("applyFollowupToEvent market_shock", () => {
  it("maps dollar corrections to portfolio severity, not unused lumpSum", () => {
    const base = suggestEventFromAnswers(
      "market_shock",
      ["30%", "6 months"],
      profile,
    );
    const { updated, explanation } = applyFollowupToEvent(
      base,
      "actually the loss is $10,000",
      { monthlyIncome: profile.monthlyIncome, portfolioValue: profile.investments.totalValue },
    );

    assert.equal(updated.severity, 5);
    assert.equal(updated.lumpSum, undefined);
    assert.match(explanation, /Severity set to 5%/);
  });
});
