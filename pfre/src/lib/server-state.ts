import { promises as fs } from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), ".pfre-state.json");
const EXCLUDED_STATE_KEYS = new Set(["chatHistory", "plaidAccessToken"]);

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export async function readServerState(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => !EXCLUDED_STATE_KEYS.has(key)),
  );
}

export async function writeServerState(state: Record<string, unknown>): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(sanitizeServerState(state)), "utf-8");
}
