import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadStateSyncModule() {
  const source = await readFile(
    new URL("../src/lib/state-sync.ts", import.meta.url),
    "utf-8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  const execute = new Function("exports", "module", outputText);
  execute(module.exports, module);
  return module.exports;
}

test("sanitizeServerState strips credentials before server persistence", async () => {
  const { sanitizeServerState } = await loadStateSyncModule();

  const sanitized = sanitizeServerState({
    profile: { id: "user-1", name: "Ada" },
    plaidAccessToken: "access-sandbox-secret",
    chatHistory: [{ role: "user", content: "private prompt" }],
    notificationSettings: { rules: [] },
    lastSyncedAt: "2026-06-02T11:00:00.000Z",
  });

  assert.deepEqual(sanitized, {
    profile: { id: "user-1", name: "Ada" },
    notificationSettings: { rules: [] },
    lastSyncedAt: "2026-06-02T11:00:00.000Z",
  });
  assert.equal("plaidAccessToken" in sanitized, false);
  assert.equal("chatHistory" in sanitized, false);
});
