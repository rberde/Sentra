import assert from "node:assert/strict";
import test from "node:test";

import {
  toStoredChatHistory,
  toUIChatMessages,
} from "./chat-history.ts";

test("persisted chat history survives UI message initialization", () => {
  const persisted = [
    {
      id: "user-1",
      role: "user",
      content: "Can I afford this expense?",
      createdAt: "2026-03-01T12:00:00.000Z",
    },
    {
      id: "assistant-1",
      role: "assistant",
      content: "Your current cash buffer can cover it.",
      createdAt: "2026-03-01T12:00:01.000Z",
    },
  ];

  const restored = toStoredChatHistory(toUIChatMessages(persisted));

  assert.deepEqual(
    restored.map(({ id, role, content }) => ({ id, role, content })),
    persisted.map(({ id, role, content }) => ({ id, role, content })),
  );
});

test("non-chat roles and empty messages are not persisted", () => {
  const restored = toStoredChatHistory([
    { id: "system-1", role: "system", parts: [{ type: "text", text: "Context" }] },
    { id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "" }] },
  ]);

  assert.deepEqual(restored, []);
});
