import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeServerState } from "./server-state.ts";

test("server state sync does not persist local-only secrets", () => {
  const sanitized = sanitizeServerState({
    profile: { name: "Alex" },
    plaidAccounts: [{ accountId: "checking", balance: 1000 }],
    plaidAccessToken: "access-sandbox-secret",
    chatHistory: [{ role: "user", content: "private" }],
    lastSyncedAt: "2026-06-13T11:00:00.000Z",
  });

  assert.deepEqual(sanitized, {
    profile: { name: "Alex" },
    plaidAccounts: [{ accountId: "checking", balance: 1000 }],
    lastSyncedAt: "2026-06-13T11:00:00.000Z",
  });
});
