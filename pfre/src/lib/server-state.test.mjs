import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const originalCwd = process.cwd();
const tempDir = await mkdtemp(path.join(os.tmpdir(), "pfre-state-"));
process.chdir(tempDir);

const {
  getStateSyncToken,
  readServerState,
  sanitizeServerState,
  writeServerState,
} = await import("./server-state.ts");

test.after(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

test("extracts bearer state sync tokens", () => {
  const token = "a".repeat(64);
  const req = new Request("http://localhost/api/state/sync", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(getStateSyncToken(req), token);
});

test("rejects missing or short state sync tokens", () => {
  assert.equal(getStateSyncToken(new Request("http://localhost/api/state/sync")), null);
  assert.equal(
    getStateSyncToken(new Request("http://localhost/api/state/sync", {
      headers: { Authorization: "Bearer short" },
    })),
    null,
  );
});

test("sanitizes sensitive client-only state before persistence", async () => {
  const token = "b".repeat(64);
  const state = {
    profile: {
      name: "Avery",
      incomeStreams: [],
      fixedExpenses: [],
      variableExpenses: [],
    },
    rebalancingPlans: [],
    notifications: [],
    plaidAccounts: [],
    plaidAccessToken: "access-secret",
    chatHistory: [{ role: "user", content: "private" }],
    lastSyncedAt: "2026-06-11T11:00:00.000Z",
  };

  await writeServerState(token, state);
  const persisted = await readServerState(token);

  assert.equal(persisted?.plaidAccessToken, undefined);
  assert.equal(persisted?.chatHistory, undefined);
  assert.equal(persisted?.profile?.name, "Avery");
});

test("rejects malformed array fields that would crash monitor readers", () => {
  assert.equal(
    sanitizeServerState({
      profile: { fixedExpenses: "not an array", variableExpenses: [] },
      rebalancingPlans: [],
    }),
    null,
  );

  assert.equal(
    sanitizeServerState({
      profile: { fixedExpenses: [], variableExpenses: [] },
      rebalancingPlans: "not an array",
    }),
    null,
  );
});

test("partitions synced state by token", async () => {
  const firstToken = "c".repeat(64);
  const secondToken = "d".repeat(64);

  await writeServerState(firstToken, { profile: { name: "First", fixedExpenses: [], variableExpenses: [] } });
  await writeServerState(secondToken, { profile: { name: "Second", fixedExpenses: [], variableExpenses: [] } });

  assert.equal((await readServerState(firstToken))?.profile?.name, "First");
  assert.equal((await readServerState(secondToken))?.profile?.name, "Second");
});
