import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stateFileForToken(syncToken: string): string {
  const digest = createHash("sha256").update(syncToken).digest("hex");
  return path.join(STATE_DIR, `${digest}.json`);
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...state };
  delete sanitized.plaidAccessToken;
  delete sanitized.chatHistory;

  if (isRecord(sanitized.notificationSettings)) {
    const notificationSettings = { ...sanitized.notificationSettings };
    delete notificationSettings.syncToken;
    sanitized.notificationSettings = notificationSettings;
  }

  return sanitized;
}

export async function readServerState(syncToken: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(stateFileForToken(syncToken), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeServerState(state: Record<string, unknown>, syncToken: string): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const stateFile = stateFileForToken(syncToken);
  const tmpFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(sanitizeServerState(state)), "utf-8");
  await fs.rename(tmpFile, stateFile);
}

export async function deleteServerState(syncToken: string): Promise<void> {
  try {
    await fs.unlink(stateFileForToken(syncToken));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
