import type { UIMessage } from "ai";
import type { ChatMessage } from "@/lib/types";

export function toUIChatMessages(history: ChatMessage[]): UIMessage[] {
  return history.map(message => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  }));
}

export function toStoredChatHistory(messages: UIMessage[]): ChatMessage[] {
  return messages
    .map(message => ({
      id: message.id,
      role: message.role,
      content: message.parts
        .filter(part => part.type === "text")
        .map(part => part.text)
        .join(""),
      createdAt: new Date().toISOString(),
    }))
    .filter(
      (message): message is ChatMessage =>
        Boolean(message.content) &&
        (message.role === "user" || message.role === "assistant"),
    );
}
