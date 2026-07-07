import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = process.cwd();
const serverStateUrl = pathToFileURL(path.join(repoRoot, "src/lib/server-state.ts")).href;
let importCounter = 0;

async function loadServerStateForCwd(cwd) {
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await import(`${serverStateUrl}?test=${importCounter++}`);
  } finally {
    process.chdir(previousCwd);
  }
}

function withEnv(values, fn) {
  const previous = {
    PFRE_SYNC_TOKEN: process.env.PFRE_SYNC_TOKEN,
    NEXT_PUBLIC_PFRE_SYNC_TOKEN: process.env.NEXT_PUBLIC_PFRE_SYNC_TOKEN,
  };

  for (const key of Object.keys(previous)) {
    delete process.env[key];
  }
  Object.assign(process.env, values);

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(previous)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test("authorizeStateRequest requires a configured matching sync token", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pfre-state-test-"));
  try {
    const { authorizeStateRequest } = await loadServerStateForCwd(tmp);

    await withEnv({}, async () => {
      const result = authorizeStateRequest(new Request("https://sentra.test/api/state/sync"));
      assert.equal(result.ok, false);
      assert.equal(result.status, 503);
    });

    await withEnv({ PFRE_SYNC_TOKEN: "secret" }, async () => {
      assert.equal(authorizeStateRequest(new Request("https://sentra.test/api/state/sync")).status, 401);
      assert.equal(authorizeStateRequest(new Request("https://sentra.test/api/state/sync?token=wrong")).status, 401);

      const headerResult = authorizeStateRequest(new Request("https://sentra.test/api/state/sync", {
        headers: { "x-pfre-sync-token": "secret" },
      }));
      assert.deepEqual(headerResult, { ok: true, token: "secret" });

      const bearerResult = authorizeStateRequest(new Request("https://sentra.test/api/monitor/spending", {
        headers: { Authorization: "Bearer secret" },
      }));
      assert.deepEqual(bearerResult, { ok: true, token: "secret" });
    });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("writeServerState persists token-scoped sanitized state", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pfre-state-test-"));
  try {
    const { readServerState, writeServerState } = await loadServerStateForCwd(tmp);

    await writeServerState("secret", {
      profile: { name: "Avery", monthlyIncome: 8000 },
      plaidAccessToken: "access-sandbox-secret",
      chatHistory: [{ role: "user", content: "hello" }],
      lastSyncedAt: "2026-07-07T11:00:00.000Z",
    });

    const state = await readServerState("secret");
    assert.deepEqual(state, {
      profile: { name: "Avery", monthlyIncome: 8000 },
      lastSyncedAt: "2026-07-07T11:00:00.000Z",
    });
    assert.equal(await readServerState("other-secret"), null);

    const [stateFile] = await readdir(path.join(tmp, ".pfre-state"));
    const raw = await readFile(path.join(tmp, ".pfre-state", stateFile), "utf-8");
    assert.equal(raw.includes("access-sandbox-secret"), false);
    assert.equal(raw.includes("chatHistory"), false);
    assert.equal(raw.includes("plaidAccessToken"), false);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
