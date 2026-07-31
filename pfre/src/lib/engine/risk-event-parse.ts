import type { RiskBucketType, RiskEvent } from "@/lib/types";

const RISK_EVENT_NAMES: Record<RiskBucketType, string> = {
  income_shock: "Job Loss / Income Shock",
  expense_shock: "Medical / Expense Shock",
  market_shock: "Market Crash",
  structural_drift: "Lifestyle Inflation",
};

/**
 * Extracts the first dollar-like number from text, handling commas and $ signs.
 * Returns null if no money-like pattern found.
 */
export function parseMoney(input: string): number | null {
  const moneyPattern = /\$?\s*([\d,]+(?:\.\d{1,2})?)/;
  const match = input.replace(/[^\d$,.\s]/g, " ").match(moneyPattern);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function parseMaybePercent(input: string): number | null {
  const lower = input.toLowerCase();
  if (
    lower.includes("lost job") ||
    lower.includes("no income") ||
    lower.includes("zero income") ||
    lower.includes("all of it") ||
    lower.includes("100%")
  ) {
    return 100;
  }
  if (lower.includes("half") || lower.includes("50%")) return 50;
  if (lower.includes("quarter") || lower.includes("25%")) return 25;

  const pctMatch = lower.match(/([\d.]+)\s*(%|percent)/);
  if (pctMatch) {
    const n = parseFloat(pctMatch[1]);
    if (Number.isFinite(n) && n > 0 && n <= 100) return Math.round(n);
  }

  return null;
}

export function parseMaybeDuration(input: string): number {
  const lower = input.toLowerCase();
  if (
    lower.includes("unknown") ||
    lower.includes("not sure") ||
    lower.includes("unsure") ||
    lower.includes("indefinite")
  ) {
    return -1;
  }

  const weekMatch = lower.match(/([\d.]+)\s*week/);
  if (weekMatch) {
    const weeks = parseFloat(weekMatch[1]);
    if (Number.isFinite(weeks) && weeks > 0) return Math.max(1, Math.round(weeks / 4.345));
  }

  const dayMatch = lower.match(/([\d.]+)\s*day/);
  if (dayMatch) {
    const days = parseFloat(dayMatch[1]);
    if (Number.isFinite(days) && days > 0) return Math.max(1, Math.round(days / 30));
  }

  const monthMatch = lower.match(/([\d.]+)\s*month/);
  if (monthMatch) {
    const months = parseFloat(monthMatch[1]);
    if (Number.isFinite(months) && months > 0) return Math.max(1, Math.round(months));
  }

  const yearMatch = lower.match(/([\d.]+)\s*year/);
  if (yearMatch) {
    const years = parseFloat(yearMatch[1]);
    if (Number.isFinite(years) && years > 0) return Math.round(years * 12);
  }

  const bare = parseFloat(lower.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(bare) && bare > 0 && bare <= 120) return Math.max(1, Math.round(bare));

  return -1;
}

function marketSeverityFromAnswers(
  parsedPercent: number | null,
  money: number | null,
  portfolioValue: number,
): number {
  let severity: number;
  if (parsedPercent !== null) {
    severity = parsedPercent;
  } else if (money !== null && portfolioValue > 0) {
    // "How much has your portfolio dropped?" often gets a dollar answer.
    // Convert dollars → % of current portfolio instead of defaulting to 30%.
    severity = Math.round((money / portfolioValue) * 100);
  } else {
    severity = 30;
  }
  return Math.min(80, Math.max(5, severity));
}

export function suggestEventFromAnswers(
  type: RiskBucketType,
  answers: string[],
  profile: { monthlyIncome: number; investments: { totalValue: number } },
): RiskEvent {
  let severity = 100;
  let duration = -1;
  let lumpSum: number | undefined;

  const answer1 = answers[0] ?? "";
  const answer2 = answers[1] ?? "";
  const money1 = parseMoney(answer1);
  const parsedPercent = parseMaybePercent(answer1);
  const parsedDuration = parseMaybeDuration(answer2);

  switch (type) {
    case "income_shock":
      if (parsedPercent !== null) {
        severity = parsedPercent;
      } else if (money1 !== null && money1 > 0 && profile.monthlyIncome > 0) {
        severity = Math.round((money1 / profile.monthlyIncome) * 100);
      }
      severity = Math.min(100, Math.max(10, severity));
      duration = parsedDuration;
      break;
    case "expense_shock":
      lumpSum = money1 !== null && money1 > 0 ? money1 : 10000;
      severity = 100;
      duration = parsedDuration === -1 ? 1 : parsedDuration;
      break;
    case "market_shock":
      severity = marketSeverityFromAnswers(
        parsedPercent,
        money1,
        profile.investments.totalValue,
      );
      duration = parsedDuration === -1 ? 6 : parsedDuration;
      break;
    case "structural_drift":
      severity = Math.min(50, Math.max(5, parsedPercent ?? 15));
      duration = parsedDuration === -1 ? 12 : parsedDuration;
      break;
  }

  return {
    id: crypto.randomUUID(),
    type,
    name: RISK_EVENT_NAMES[type],
    severity,
    duration,
    lumpSum,
    aiSuggested: true,
    isActive: true,
    description: `Based on your answers: "${answers.join('" and "')}"`,
  };
}

/**
 * Apply a free-text correction to a suggested risk event.
 * Dollar answers for market shocks update severity (% of portfolio), not lumpSum.
 */
export function applyFollowupToEvent(
  event: RiskEvent,
  message: string,
  profile: { monthlyIncome: number; portfolioValue: number },
): { updated: RiskEvent; explanation: string } {
  const lower = message.toLowerCase();
  const next: RiskEvent = { ...event };
  const changes: string[] = [];

  const mentionsMoney = /\$|dollar|cost|amount|bill|lump|expense|pay|price|owe|interest/i.test(message);
  const mentionsDuration = /\b(month|week|day|year|long|duration|time|last|until|indefinite|unknown)\b/i.test(message);
  const mentionsSeverity = /\b(percent|%|severity|half|quarter|all|income|reduction|lost|drop)\b/i.test(message);
  const mentionsInterestRate = /\b(interest|apr|rate)\b/i.test(lower);

  const money = parseMoney(message);
  const duration = parseMaybeDuration(message);
  const percent = parseMaybePercent(message);

  const applyMarketDollars = (amount: number) => {
    if (profile.portfolioValue > 0) {
      next.severity = Math.min(80, Math.max(5, Math.round((amount / profile.portfolioValue) * 100)));
      changes.push(`Severity set to ${next.severity}% ($${amount.toLocaleString()} of portfolio)`);
    } else {
      changes.push("Could not convert dollar loss without a portfolio value");
    }
  };

  if (mentionsInterestRate && money !== null) {
    next.lumpSum = money;
    changes.push(`Expense amount set to $${money.toLocaleString()}`);
  } else if (mentionsMoney && !mentionsDuration && !mentionsSeverity && money !== null) {
    if (event.type === "expense_shock") {
      next.lumpSum = money;
      changes.push(`Expense amount set to $${money.toLocaleString()}`);
    } else if (event.type === "income_shock" && profile.monthlyIncome > 0) {
      next.severity = Math.min(100, Math.max(10, Math.round((money / profile.monthlyIncome) * 100)));
      changes.push(`Severity set to ${next.severity}%`);
    } else if (event.type === "market_shock") {
      applyMarketDollars(money);
    }
  } else if (mentionsDuration && !mentionsMoney && !mentionsSeverity) {
    if (duration !== -1) {
      next.duration = duration;
      changes.push(`Duration set to ${duration} months`);
    } else {
      next.duration = -1;
      changes.push("Duration set to unknown");
    }
  } else if (mentionsSeverity && !mentionsMoney && !mentionsDuration && percent !== null) {
    next.severity = percent;
    changes.push(`Severity set to ${percent}%`);
  } else {
    if (money !== null && event.type === "market_shock" && (mentionsMoney || !percent)) {
      applyMarketDollars(money);
    } else if (money !== null && (event.type === "expense_shock" || mentionsMoney)) {
      next.lumpSum = money;
      changes.push(`Expense amount set to $${money.toLocaleString()}`);
    } else if (percent !== null) {
      next.severity = percent;
      changes.push(`Severity set to ${percent}%`);
    }
    if (duration !== -1 && mentionsDuration) {
      next.duration = duration;
      changes.push(`Duration set to ${duration} months`);
    }
  }

  if (lower.includes("unknown duration") || lower.includes("not sure how long") || lower.includes("indefinite")) {
    next.duration = -1;
    changes.push("Duration set to unknown");
  }

  const explanation =
    changes.length > 0
      ? changes.join("; ") + "."
      : "I couldn't determine what to change from that message. Try being more specific.";
  return { updated: next, explanation };
}
