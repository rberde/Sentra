/**
 * Helpers for fetching Plaid /transactions/get results with offset pagination.
 *
 * Plaid returns at most `count` transactions per call (default 100, max 500),
 * newest first. Callers that only consume the first page silently undercount
 * spend when an Item has more than one page in the requested window.
 */

export const PLAID_TRANSACTIONS_PAGE_SIZE = 500;
export const PLAID_TRANSACTIONS_MAX_PAGES = 20;

export interface PlaidTransactionsPage<T> {
  transactions: T[];
  total_transactions: number;
}

/**
 * Walks offset pages until every transaction in the window is collected
 * (or a safety page cap is hit). Deduplicates by optional transaction_id.
 */
export async function paginatePlaidTransactions<T>(
  fetchPage: (offset: number, count: number) => Promise<PlaidTransactionsPage<T>>,
  options?: {
    pageSize?: number;
    maxPages?: number;
    getTransactionId?: (tx: T) => string | null | undefined;
  },
): Promise<T[]> {
  const pageSize = options?.pageSize ?? PLAID_TRANSACTIONS_PAGE_SIZE;
  const maxPages = options?.maxPages ?? PLAID_TRANSACTIONS_MAX_PAGES;
  const getTransactionId = options?.getTransactionId;

  const collected: T[] = [];
  const seenIds = new Set<string>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  for (let page = 0; page < maxPages && offset < total; page += 1) {
    const response = await fetchPage(offset, pageSize);
    const batch = Array.isArray(response.transactions) ? response.transactions : [];
    total = typeof response.total_transactions === "number" && Number.isFinite(response.total_transactions)
      ? response.total_transactions
      : offset + batch.length;

    for (const tx of batch) {
      const id = getTransactionId?.(tx);
      if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }
      collected.push(tx);
    }

    if (batch.length === 0) break;
    offset += batch.length;
    // Guard against a stuck API that never advances total/offset.
    if (batch.length < pageSize && collected.length >= total) break;
  }

  return collected;
}
