import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

test("server state is token-scoped and strips client-only secrets", async () => {
  const previousCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), "pfre-state-"));

  process.chdir(tempDir);
  try {
    const serverState = await import(`./server-state.ts?test=${Date.now()}`);
    const tokenA = "token-a-1234567890";
    const tokenB = "token-b-1234567890";

    assert.equal(serverState.getServerStateToken(new Request("http://localhost/api/state/sync")), null);
    assert.equal(
      serverState.getServerStateToken(new Request("http://localhost/api/state/sync?token=query-token-123456")),
      "query-token-123456",
    );
    assert.equal(
      serverState.getServerStateToken(new Request("http://localhost/api/state/sync", {
        headers: { "x-pfre-sync-token": tokenA },
      })),
      tokenA,
    );

    await serverState.writeServerState(tokenA, {
      profile: { name: "Alice" },
      plaidAccessToken: "plaid-secret",
      chatHistory: [{ role: "user", content: "private" }],
      lastSyncedAt: "2026-07-06T11:00:00.000Z",
    });
    await serverState.writeServerState(tokenB, {
      profile: { name: "Bob" },
      lastSyncedAt: "2026-07-06T11:01:00.000Z",
    });

    const stateA = await serverState.readServerState(tokenA);
    const stateB = await serverState.readServerState(tokenB);

    assert.deepEqual(stateA?.profile, { name: "Alice" });
    assert.equal("plaidAccessToken" in stateA, false);
    assert.equal("chatHistory" in stateA, false);
    assert.deepEqual(stateB?.profile, { name: "Bob" });
    assert.equal(await serverState.readServerState("unknown-token-123456"), null);

    await serverState.deleteServerState(tokenA);
    assert.equal(await serverState.readServerState(tokenA), null);
    assert.deepEqual((await serverState.readServerState(tokenB))?.profile, { name: "Bob" });
  } finally {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
