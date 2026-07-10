import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("sanitizeServerState removes secrets before persistence", async () => {
  const { sanitizeServerState } = await import(`./server-state.ts?sanitize=${Date.now()}`);
  const sanitized = sanitizeServerState({
    plaidAccessToken: "access-token",
    chatHistory: [{ role: "user", content: "private" }],
    notificationSettings: {
      syncToken: "sync-token",
      frequency: "daily_digest",
    },
    lastSyncedAt: "2026-07-10T11:00:00.000Z",
  });

  assert.equal("plaidAccessToken" in sanitized, false);
  assert.equal("chatHistory" in sanitized, false);
  assert.deepEqual(sanitized.notificationSettings, { frequency: "daily_digest" });
  assert.equal(sanitized.lastSyncedAt, "2026-07-10T11:00:00.000Z");
});

test("server state is isolated by sync token and stored without secrets", async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), "pfre-state-test-"));

  try {
    process.chdir(tempDir);
    const {
      deleteServerState,
      readServerState,
      writeServerState,
    } = await import(`./server-state.ts?state=${Date.now()}`);

    await writeServerState({
      profile: { name: "User A" },
      plaidAccessToken: "access-token-a",
      notificationSettings: { syncToken: "token-a" },
    }, "token-a");
    await writeServerState({
      profile: { name: "User B" },
      plaidAccessToken: "access-token-b",
      notificationSettings: { syncToken: "token-b" },
    }, "token-b");

    assert.deepEqual(await readServerState("token-a"), {
      profile: { name: "User A" },
      notificationSettings: {},
    });
    assert.deepEqual(await readServerState("token-b"), {
      profile: { name: "User B" },
      notificationSettings: {},
    });

    const files = await readdir(path.join(tempDir, ".pfre-state"));
    assert.equal(files.length, 2);
    for (const file of files) {
      const raw = await readFile(path.join(tempDir, ".pfre-state", file), "utf-8");
      assert.equal(raw.includes("access-token"), false);
      assert.equal(raw.includes("token-"), false);
    }

    await deleteServerState("token-a");
    assert.equal(await readServerState("token-a"), null);
    assert.deepEqual(await readServerState("token-b"), {
      profile: { name: "User B" },
      notificationSettings: {},
    });
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});
