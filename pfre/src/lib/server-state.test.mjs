import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("server state is token scoped and sanitized before persistence", async (t) => {
  const previousCwd = process.cwd();
  const workspace = await mkdtemp(path.join(tmpdir(), "pfre-state-"));
  process.chdir(workspace);

  t.after(async () => {
    process.chdir(previousCwd);
    await rm(workspace, { recursive: true, force: true });
  });

  const {
    readServerState,
    writeServerState,
  } = await import(`./server-state.ts?test=${Date.now()}`);

  const token = "11111111-1111-4111-8111-111111111111";
  const otherToken = "22222222-2222-4222-8222-222222222222";

  await writeServerState(token, {
    profile: { name: "Ada", monthlyIncome: 10000 },
    plaidAccessToken: "access-production-secret",
    chatHistory: [{ role: "user", content: "private" }],
    lastSyncedAt: "2026-07-04T11:00:00.000Z",
  });

  const state = await readServerState(token);
  assert.deepEqual(state, {
    profile: { name: "Ada", monthlyIncome: 10000 },
    lastSyncedAt: "2026-07-04T11:00:00.000Z",
  });
  assert.equal(await readServerState(otherToken), null);

  const files = await readdir(path.join(workspace, ".pfre-state"));
  assert.equal(files.length, 1);
  assert.equal(files[0].includes(token), false);

  const persisted = await readFile(path.join(workspace, ".pfre-state", files[0]), "utf-8");
  assert.equal(persisted.includes("access-production-secret"), false);
  assert.equal(persisted.includes("private"), false);
});
