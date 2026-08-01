export type PlaidExpenseTransaction = {
  name: string;
  amount: number;
  pending?: boolean;
  merchant_name?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
};

export type EstimatedExpense = {
  name: string;
  amount: number;
  category: ExpenseCategory;
  type: "fixed" | "variable";
};

export type ExpenseCategory =
  | "housing"
  | "transport"
  | "food"
  | "insurance"
  | "loans"
  | "subscriptions"
  | "entertainment"
  | "shopping"
  | "other";

const NON_EXPENSE_PRIMARIES = new Set([
  "INCOME",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "TRANSFER_THIRD_PARTY",
  // Debt-service payments are not living expenses. Student-loan minimums are
  // attached separately from Plaid liabilities during onboarding.
  "LOAN_PAYMENTS",
]);

const FIXED_CATEGORIES = new Set<ExpenseCategory>([
  "housing",
  "insurance",
  "loans",
  "subscriptions",
]);

const RECURRING_NAME_RE =
  /\b(internet|mobile|phone|gym|fitness|netflix|spotify|insurance|hydro|electric|gas\s*bill|water\s*bill|rogers|bell|telus|koodo|fido|shaw|cogeco|rent|mortgage|monthly)\b/;

const NON_EXPENSE_NAME_RE =
  /\b(transfer|xfer|zelle|venmo|paypal|cash\s*app|credit\s*card\s*payment|payment\s*to\s*.*\bcard|card\s*payment|autopay|ach\s*payment|loan\s*payment|student\s*loan|nelnet|mohela|navient|great\s*lakes|vanguard|fidelity|schwab|robinhood|coinbase|brokerage|contribution|401\s*k|roth\s*ira|ira\s*contribution)\b/;

/**
 * Returns true for money movement that should not count toward monthly living burn
 * (own-account transfers, credit-card/loan payments, investment contributions).
 */
export function isNonExpenseTransaction(tx: PlaidExpenseTransaction): boolean {
  const primary = (tx.personal_finance_category?.primary ?? "").toUpperCase();
  if (primary && NON_EXPENSE_PRIMARIES.has(primary)) {
    return true;
  }
  if (primary.startsWith("TRANSFER")) {
    return true;
  }

  const detailed = (tx.personal_finance_category?.detailed ?? "").toUpperCase();
  if (
    detailed.includes("CREDIT_CARD_PAYMENT") ||
    detailed.includes("ACCOUNT_TRANSFER") ||
    detailed.includes("INVESTMENT") ||
    (detailed.includes("DEPOSIT") && detailed.includes("TRANSFER"))
  ) {
    return true;
  }

  const name = `${tx.merchant_name ?? ""} ${tx.name ?? ""}`.toLowerCase();
  return NON_EXPENSE_NAME_RE.test(name);
}

export function mapExpenseCategory(primary: string): ExpenseCategory {
  const value = primary.toUpperCase();
  if (value.includes("RENT") || value.includes("MORTGAGE") || value.includes("HOUSING")) return "housing";
  if (value.includes("TRANSPORT") || value.includes("GAS") || value.includes("AUTOMOTIVE")) return "transport";
  if (value.includes("FOOD") || value.includes("RESTAURANT") || value.includes("GROCERY")) return "food";
  if (value.includes("INSURANCE")) return "insurance";
  if (value.includes("LOAN") || value.includes("DEBT")) return "loans";
  if (value.includes("SUBSCRIPTION") || value.includes("BILL")) return "subscriptions";
  if (value.includes("ENTERTAINMENT") || value.includes("TRAVEL")) return "entertainment";
  if (value.includes("SHOPPING") || value.includes("GENERAL_MERCHANDISE")) return "shopping";
  return "other";
}

function looksFixedExpense(entry: {
  name: string;
  category: ExpenseCategory;
}): boolean {
  if (FIXED_CATEGORIES.has(entry.category)) return true;
  return RECURRING_NAME_RE.test(entry.name.toLowerCase());
}

function withOtherTail(
  expenses: EstimatedExpense[],
  limit: number,
  type: "fixed" | "variable",
): EstimatedExpense[] {
  if (expenses.length <= limit) return expenses;
  const kept = expenses.slice(0, limit);
  const otherAmount = expenses.slice(limit).reduce((sum, e) => sum + e.amount, 0);
  if (otherAmount < 20) return kept;
  return [
    ...kept,
    {
      name: "Other expenses",
      amount: Number(otherAmount.toFixed(2)),
      category: "other",
      type,
    },
  ];
}

/**
 * Build monthly fixed/variable expense estimates from Plaid transactions.
 * Excludes transfers, debt payments, and investment contributions so burn
 * reflects living costs rather than cash movement between accounts.
 */
export function buildExpenseEstimates(
  transactions: PlaidExpenseTransaction[],
  options?: { windowDays?: number },
): {
  fixedExpenses: EstimatedExpense[];
  variableExpenses: EstimatedExpense[];
} {
  const windowDays = options?.windowDays ?? 90;
  const monthlyFactor = windowDays / 30;
  const expenseTx = transactions.filter(
    (t) => !t.pending && t.amount > 0 && !isNonExpenseTransaction(t),
  );

  const grouped = new Map<
    string,
    { name: string; total: number; occurrences: number; category: ExpenseCategory }
  >();

  for (const tx of expenseTx) {
    const key = (tx.merchant_name || tx.name || "Unknown").trim().toLowerCase();
    const category = mapExpenseCategory(tx.personal_finance_category?.primary ?? "");
    const entry = grouped.get(key);
    if (entry) {
      entry.total += tx.amount;
      entry.occurrences += 1;
    } else {
      grouped.set(key, {
        name: tx.merchant_name || tx.name || "Expense",
        total: tx.amount,
        occurrences: 1,
        category,
      });
    }
  }

  const fixedExpenses: EstimatedExpense[] = [];
  const variableExpenses: EstimatedExpense[] = [];

  for (const entry of grouped.values()) {
    const monthlyAmount = Number((entry.total / monthlyFactor).toFixed(2));
    if (monthlyAmount < 20) continue;

    const normalized = {
      name: entry.name,
      amount: monthlyAmount,
      category: entry.category,
    };

    if (looksFixedExpense(normalized)) {
      fixedExpenses.push({ ...normalized, type: "fixed" });
    } else {
      variableExpenses.push({ ...normalized, type: "variable" });
    }
  }

  fixedExpenses.sort((a, b) => b.amount - a.amount);
  variableExpenses.sort((a, b) => b.amount - a.amount);

  return {
    fixedExpenses: withOtherTail(fixedExpenses, 10, "fixed"),
    variableExpenses: withOtherTail(variableExpenses, 15, "variable"),
  };
}
