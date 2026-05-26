import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./monitoring.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const monitoring = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`);

test("spending usage compares actual spending against the plan dollar budget", () => {
  const usage = monitoring.calculateSpendingUsage(1200, 1000, { threshold: 100 });

  assert.equal(usage.variableCap, 1000);
  assert.equal(usage.percentUsed, 120);
  assert.equal(usage.threshold, 100);
  assert.equal(usage.alert, true);
});

test("stale AI-generated dollar thresholds are normalized to a budget percentage", () => {
  const usage = monitoring.calculateSpendingUsage(1100, 1000, {
    threshold: 1000,
    aiGenerated: true,
  });

  assert.equal(usage.threshold, 100);
  assert.equal(usage.alert, true);
});

test("custom percentage thresholds are preserved", () => {
  const usage = monitoring.calculateSpendingUsage(1200, 1000, { threshold: 150 });

  assert.equal(usage.threshold, 150);
  assert.equal(usage.alert, false);
});

test("drift categories use planned monthly dollars as the baseline", () => {
  const categories = monitoring.calculateDriftCategories(
    { fixedExpenses: 2200, variableExpenses: 1200, investments: 400 },
    { fixedExpenses: 2000, variableExpenses: 1000, investments: 500 },
  );

  assert.deepEqual(categories, [
    { name: "Fixed Expenses", actual: 2200, planned: 2000, driftPct: 10 },
    { name: "Variable Expenses", actual: 1200, planned: 1000, driftPct: 20 },
    { name: "Investments", actual: 400, planned: 500, driftPct: 20 },
  ]);
});
