import test from "node:test";
import assert from "node:assert/strict";
import { requireSyncAuth, SYNC_TOKEN_HEADER } from "./sync-auth.ts";

const originalToken = process.env.PFRE_SYNC_TOKEN;

test.after(() => {
  if (originalToken === undefined) {
    delete process.env.PFRE_SYNC_TOKEN;
  } else {
    process.env.PFRE_SYNC_TOKEN = originalToken;
  }
});

test("requireSyncAuth rejects requests when the server token is missing", () => {
  delete process.env.PFRE_SYNC_TOKEN;

  const result = requireSyncAuth(new Request("http://localhost/api/n8n/evaluate"));

  assert.equal("response" in result, true);
  if ("response" in result) {
    assert.equal(result.response.status, 503);
  }
});

test("requireSyncAuth rejects missing and incorrect request tokens", () => {
  process.env.PFRE_SYNC_TOKEN = "server-secret";

  const missing = requireSyncAuth(new Request("http://localhost/api/n8n/evaluate"));
  assert.equal("response" in missing, true);
  if ("response" in missing) {
    assert.equal(missing.response.status, 401);
  }

  const incorrect = requireSyncAuth(new Request("http://localhost/api/n8n/evaluate", {
    headers: { [SYNC_TOKEN_HEADER]: "wrong-secret" },
  }));
  assert.equal("response" in incorrect, true);
  if ("response" in incorrect) {
    assert.equal(incorrect.response.status, 401);
  }
});

test("requireSyncAuth accepts header and bearer tokens", () => {
  process.env.PFRE_SYNC_TOKEN = "server-secret";

  const headerResult = requireSyncAuth(new Request("http://localhost/api/n8n/evaluate", {
    headers: { [SYNC_TOKEN_HEADER]: "server-secret" },
  }));
  assert.deepEqual(headerResult, { token: "server-secret" });

  const bearerResult = requireSyncAuth(new Request("http://localhost/api/n8n/evaluate", {
    headers: { authorization: "Bearer server-secret" },
  }));
  assert.deepEqual(bearerResult, { token: "server-secret" });
});
