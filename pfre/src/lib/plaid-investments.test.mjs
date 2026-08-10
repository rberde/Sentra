import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePlaidInvestmentValue } from "./plaid-investments.ts";

describe("resolvePlaidInvestmentValue", () => {
  it("prefers holdings total when holdings are present", () => {
    assert.equal(
      resolvePlaidInvestmentValue({
        investmentHoldings: [
          { value: 40_000 },
          { value: 60_000 },
        ],
        investmentsTotalValue: 95_000,
        accounts: [{ type: "investment" }],
        previousTotalValue: 10_000,
      }),
      100_000,
    );
  });

  it("falls back to investment account balances when holdings are empty", () => {
    assert.equal(
      resolvePlaidInvestmentValue({
        investmentHoldings: [],
        investmentsTotalValue: 80_000,
        accounts: [{ type: "investment" }, { type: "checking" }],
        previousTotalValue: 10_000,
      }),
      80_000,
    );
  });

  it("zeros portfolio when linked investment accounts are empty after liquidation", () => {
    assert.equal(
      resolvePlaidInvestmentValue({
        investmentHoldings: [],
        investmentsTotalValue: 0,
        accounts: [{ type: "investment" }, { type: "checking" }],
        previousTotalValue: 100_000,
      }),
      0,
    );
  });

  it("preserves manual portfolio when Plaid has no investment accounts", () => {
    assert.equal(
      resolvePlaidInvestmentValue({
        investmentHoldings: [],
        investmentsTotalValue: 0,
        accounts: [{ type: "checking" }, { type: "savings" }],
        previousTotalValue: 50_000,
      }),
      50_000,
    );
  });
});
