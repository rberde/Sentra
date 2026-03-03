import { promises as fs } from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), ".pfre-state.json");

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

export async function writeServerState(state: Record<string, unknown>): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state), "utf-8");
}
