import test from "node:test";
import assert from "node:assert/strict";
import { mergeExpenses } from "./expense-merge.ts";

test("mergeExpenses updates matching Plaid estimates without dropping manual expenses", () => {
  const existing = [
    { name: "Rent", amount: 1800, category: "housing", type: "fixed" },
    { name: "Internet", amount: 80, category: "subscriptions", type: "fixed" },
    { name: "Groceries", amount: 550, category: "food", type: "variable" },
  ];
  const incoming = [
    { name: "Rent", amount: 1850, category: "housing", type: "fixed" },
    { name: "Utilities", amount: 120, category: "other", type: "fixed" },
  ];

  assert.deepEqual(mergeExpenses(existing, incoming), [
    { name: "Rent", amount: 1850, category: "housing", type: "fixed" },
    { name: "Internet", amount: 80, category: "subscriptions", type: "fixed" },
    { name: "Groceries", amount: 550, category: "food", type: "variable" },
    { name: "Utilities", amount: 120, category: "other", type: "fixed" },
  ]);
});
