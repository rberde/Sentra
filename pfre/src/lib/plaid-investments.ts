type HoldingLike = { value: number };
type AccountLike = { type: string };

/**
 * Resolve portfolio totalValue from a Plaid autofill/exchange payload.
 *
 * Prefer holdings when present; otherwise use investment account balances.
 * When Plaid reports investment accounts at $0 (or empty holdings with $0
 * account total), return 0 so liquidation is not ignored.
 * When no investment accounts are linked, preserve previousTotalValue so a
 * cash-only Plaid refresh does not wipe a manually entered portfolio.
 */
export function resolvePlaidInvestmentValue(input: {
  investmentHoldings?: HoldingLike[] | null;
  investmentsTotalValue?: number | null;
  accounts?: AccountLike[] | null;
  previousTotalValue?: number | null;
}): number {
  const holdingsTotal = (input.investmentHoldings ?? []).reduce(
    (sum, holding) => sum + (Number.isFinite(holding.value) ? holding.value : 0),
    0,
  );
  const accountTotal =
    typeof input.investmentsTotalValue === "number" && Number.isFinite(input.investmentsTotalValue)
      ? Math.max(0, input.investmentsTotalValue)
      : 0;
  const resolved = holdingsTotal > 0 ? holdingsTotal : accountTotal;
  const hasInvestmentAccounts = (input.accounts ?? []).some(
    (account) => account.type === "investment",
  );
  const previous =
    typeof input.previousTotalValue === "number" && Number.isFinite(input.previousTotalValue)
      ? Math.max(0, input.previousTotalValue)
      : 0;

  if (resolved > 0) return resolved;
  if (hasInvestmentAccounts) return 0;
  return previous;
}
