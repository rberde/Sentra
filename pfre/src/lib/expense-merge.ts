import type { Expense } from "@/lib/types";

function expenseKey(expense: Expense): string {
  return [
    expense.type,
    expense.category,
    expense.name.trim().toLowerCase(),
  ].join(":");
}

export function mergeExpenses(existing: Expense[], incoming: Expense[]): Expense[] {
  if (incoming.length === 0) return existing;

  const merged = [...existing];
  const indexByKey = new Map(merged.map((expense, index) => [expenseKey(expense), index]));

  for (const expense of incoming) {
    const key = expenseKey(expense);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(expense);
    } else {
      merged[existingIndex] = { ...merged[existingIndex], ...expense };
    }
  }

  return merged;
}
