import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExpenseEstimates,
  isNonExpenseTransaction,
} from "./plaid-expenses.ts";

describe("isNonExpenseTransaction", () => {
  it("excludes transfer and loan-payment PFC primaries", () => {
    assert.equal(
      isNonExpenseTransaction({
        name: "Savings Transfer",
        amount: 1000,
        personal_finance_category: { primary: "TRANSFER_OUT" },
      }),
      true,
    );
    assert.equal(
      isNonExpenseTransaction({
        name: "Chase Card Payment",
        amount: 1500,
        personal_finance_category: { primary: "LOAN_PAYMENTS" },
      }),
      true,
    );
  });

  it("excludes investment contributions by name when PFC is missing", () => {
    assert.equal(
      isNonExpenseTransaction({
        name: "Vanguard Contribution",
        amount: 500,
      }),
      true,
    );
  });

  it("keeps ordinary living expenses", () => {
    assert.equal(
      isNonExpenseTransaction({
        name: "Whole Foods",
        amount: 120,
        personal_finance_category: { primary: "FOOD_AND_DRINK" },
      }),
      false,
    );
  });
});

describe("buildExpenseEstimates", () => {
  it("does not inflate living burn with transfers, CC payments, or contributions", () => {
    const transactions = [
      // Living expenses (3 months)
      ...[0, 1, 2].flatMap(() => [
        {
          name: "Landlord LLC",
          amount: 2000,
          personal_finance_category: { primary: "RENT_AND_UTILITIES" },
        },
        {
          name: "Whole Foods",
          amount: 400,
          merchant_name: "Whole Foods",
          personal_finance_category: { primary: "FOOD_AND_DRINK" },
        },
        {
          name: "Uber Trip",
          amount: 120,
          merchant_name: "Uber",
          personal_finance_category: { primary: "TRANSPORTATION" },
        },
      ]),
      // Non-expenses that previously polluted burn
      ...[0, 1, 2].flatMap(() => [
        {
          name: "Chase Credit Card Payment",
          amount: 1500,
          personal_finance_category: { primary: "LOAN_PAYMENTS" },
        },
        {
          name: "Transfer to Savings",
          amount: 1000,
          personal_finance_category: { primary: "TRANSFER_OUT" },
        },
        {
          name: "Vanguard Brokerage Contribution",
          amount: 500,
        },
      ]),
    ];

    const { fixedExpenses, variableExpenses } = buildExpenseEstimates(transactions);
    const burn =
      fixedExpenses.reduce((s, e) => s + e.amount, 0) +
      variableExpenses.reduce((s, e) => s + e.amount, 0);

    assert.ok(burn < 3000, `expected living burn ~$2520, got ${burn}`);
    assert.ok(burn > 2400, `expected living burn ~$2520, got ${burn}`);
    assert.equal(
      [...fixedExpenses, ...variableExpenses].some((e) =>
        /chase|transfer|vanguard/i.test(e.name),
      ),
      false,
    );
  });

  it("keeps recurring groceries/transport as variable so plans can cut them", () => {
    const transactions = [0, 1, 2].flatMap(() => [
      {
        name: "Whole Foods",
        amount: 400,
        merchant_name: "Whole Foods",
        personal_finance_category: { primary: "FOOD_AND_DRINK" },
      },
      {
        name: "Uber Trip",
        amount: 80,
        merchant_name: "Uber",
        personal_finance_category: { primary: "TRANSPORTATION" },
      },
      {
        name: "Landlord LLC",
        amount: 2000,
        personal_finance_category: { primary: "RENT_AND_UTILITIES" },
      },
    ]);

    const { fixedExpenses, variableExpenses } = buildExpenseEstimates(transactions);
    assert.ok(fixedExpenses.some((e) => /landlord|rent/i.test(e.name)));
    assert.ok(variableExpenses.some((e) => /whole foods/i.test(e.name)));
    assert.ok(variableExpenses.some((e) => /uber/i.test(e.name)));
    assert.equal(
      fixedExpenses.some((e) => /whole foods|uber/i.test(e.name)),
      false,
    );
  });

  it("preserves dollars when more merchants exist than the display cap", () => {
    const transactions = [];
    for (let i = 0; i < 20; i += 1) {
      transactions.push({
        name: `Shop ${i}`,
        amount: 100 + i * 10,
        personal_finance_category: { primary: "GENERAL_MERCHANDISE" },
      });
    }

    const { variableExpenses } = buildExpenseEstimates(transactions);
    const total = variableExpenses.reduce((s, e) => s + e.amount, 0);
    // 20 merchants * avg ~$195 over 3-month factor (90/30=3) => monthly sum of all
    // amounts/3. Full monthly total = sum(100..290)/3 = 3900/3 = 1300.
    assert.ok(variableExpenses.some((e) => e.name === "Other expenses"));
    assert.ok(total > 1200, `expected ~$1300 preserved, got ${total}`);
  });
});
