import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAID_TRANSACTIONS_PAGE_SIZE,
  paginatePlaidTransactions,
} from "./plaid-transactions.ts";

function makeTx(id, amount = 10) {
  return { transaction_id: id, amount, name: `Tx ${id}` };
}

test("paginatePlaidTransactions fetches every page until total_transactions is reached", async () => {
  const pages = [
    { transactions: Array.from({ length: 100 }, (_, i) => makeTx(`a${i}`)), total_transactions: 250 },
    { transactions: Array.from({ length: 100 }, (_, i) => makeTx(`b${i}`)), total_transactions: 250 },
    { transactions: Array.from({ length: 50 }, (_, i) => makeTx(`c${i}`)), total_transactions: 250 },
  ];
  let calls = 0;

  const all = await paginatePlaidTransactions(
    async (offset, count) => {
      const page = pages[calls];
      calls += 1;
      assert.equal(count, 100);
      assert.equal(offset, (calls - 1) * 100);
      return page;
    },
    {
      pageSize: 100,
      getTransactionId: (tx) => tx.transaction_id,
    },
  );

  assert.equal(calls, 3);
  assert.equal(all.length, 250);
  assert.equal(all[0].transaction_id, "a0");
  assert.equal(all[249].transaction_id, "c49");
});

test("paginatePlaidTransactions does not undercount when first page is only a partial window", async () => {
  // Simulates a busy checking account: 180 txs / 90 days, default Plaid page = 100.
  // Without pagination, monthly burn would be estimated from ~50 days of spend
  // while still dividing by the full 90-day factor.
  const total = 180;
  const pageSize = 100;
  const txs = Array.from({ length: total }, (_, i) => makeTx(`t${i}`, 25));

  const all = await paginatePlaidTransactions(
    async (offset, count) => ({
      transactions: txs.slice(offset, offset + count),
      total_transactions: total,
    }),
    {
      pageSize,
      getTransactionId: (tx) => tx.transaction_id,
    },
  );

  assert.equal(all.length, total);
  const firstPageOnly = txs.slice(0, pageSize);
  assert.equal(firstPageOnly.length, 100);
  assert.ok(all.length > firstPageOnly.length);
});

test("paginatePlaidTransactions deduplicates overlapping pages by transaction_id", async () => {
  const all = await paginatePlaidTransactions(
    async (offset) => {
      if (offset === 0) {
        return {
          transactions: [makeTx("1"), makeTx("2"), makeTx("3")],
          total_transactions: 4,
        };
      }
      return {
        transactions: [makeTx("3"), makeTx("4")],
        total_transactions: 4,
      };
    },
    {
      pageSize: 3,
      getTransactionId: (tx) => tx.transaction_id,
    },
  );

  assert.deepEqual(all.map((t) => t.transaction_id), ["1", "2", "3", "4"]);
});

test("paginatePlaidTransactions stops on empty page and respects maxPages", async () => {
  let calls = 0;
  const emptyStop = await paginatePlaidTransactions(async () => {
    calls += 1;
    return { transactions: [], total_transactions: 50 };
  }, { pageSize: 50, maxPages: 5 });
  assert.equal(emptyStop.length, 0);
  assert.equal(calls, 1);

  calls = 0;
  const capped = await paginatePlaidTransactions(
    async (offset, count) => {
      calls += 1;
      return {
        transactions: Array.from({ length: count }, (_, i) => makeTx(`${offset + i}`)),
        total_transactions: 10_000,
      };
    },
    { pageSize: 10, maxPages: 2, getTransactionId: (tx) => tx.transaction_id },
  );
  assert.equal(calls, 2);
  assert.equal(capped.length, 20);
});

test("default page size matches Plaid maximum request size", () => {
  assert.equal(PLAID_TRANSACTIONS_PAGE_SIZE, 500);
});
