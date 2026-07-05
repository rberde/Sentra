import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const originalCwd = process.cwd();
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pfre-state-"));
process.chdir(tmpDir);

const {
  getStateToken,
  readServerState,
  sanitizeServerState,
  writeServerState,
} = await import("./server-state.ts");

test.after(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("extracts sync token from header, bearer auth, or query string", () => {
  const headerToken = "header-token-123456";
  const bearerToken = "bearer-token-123456";
  const queryToken = "query-token-123456";

  assert.equal(
    getStateToken(new Request("http://example.test/api/state/sync", {
      headers: { "x-pfre-sync-token": headerToken },
    })),
    headerToken,
  );
  assert.equal(
    getStateToken(new Request("http://example.test/api/state/sync", {
      headers: { authorization: `Bearer ${bearerToken}` },
    })),
    bearerToken,
  );
  assert.equal(
    getStateToken(new Request(`http://example.test/api/state/sync?token=${queryToken}`)),
    queryToken,
  );
  assert.equal(getStateToken(new Request("http://example.test/api/state/sync?token=short")), null);
});

test("writes token-scoped sanitized state without client-only secrets", async () => {
  const aliceToken = "alice-token-123456";
  const bobToken = "bob-token-123456";

  await writeServerState(aliceToken, {
    profile: { name: "Alice" },
    plaidAccessToken: "access-secret",
    chatHistory: [{ role: "user", content: "private" }],
    lastSyncedAt: "2026-07-05T11:00:00.000Z",
  });

  assert.deepEqual(await readServerState(aliceToken), {
    profile: { name: "Alice" },
    lastSyncedAt: "2026-07-05T11:00:00.000Z",
  });
  assert.equal(await readServerState(bobToken), null);

  const files = await fs.readdir(path.join(tmpDir, ".pfre-state"));
  assert.equal(files.length, 1);
  assert.match(files[0], /^[a-f0-9]{64}\.json$/);
});

test("sanitizeServerState strips fields that must never be persisted server-side", () => {
  assert.deepEqual(
    sanitizeServerState({
      profile: { name: "Alice" },
      plaidAccessToken: "access-secret",
      chatHistory: [],
    }),
    { profile: { name: "Alice" } },
  );
});
