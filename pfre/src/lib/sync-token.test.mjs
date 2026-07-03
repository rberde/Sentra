import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeSyncToken, STATE_SYNC_TOKEN_HEADER } from "./sync-token.ts";

test("normalizes valid sync tokens", () => {
  assert.equal(STATE_SYNC_TOKEN_HEADER, "x-pfre-sync-token");
  assert.equal(
    normalizeSyncToken("  0123456789abcdef0123456789abcdef  "),
    "0123456789abcdef0123456789abcdef",
  );
});

test("rejects missing, short, or unsafe sync tokens", () => {
  assert.equal(normalizeSyncToken(null), null);
  assert.equal(normalizeSyncToken("short-token"), null);
  assert.equal(normalizeSyncToken("0123456789abcdef0123456789abcde!"), null);
});
