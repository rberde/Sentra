import { promises as fs } from "fs";
import { createHash } from "crypto";
import path from "path";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");
const TOKEN_HEADER = "x-pfre-sync-token";

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export function getServerStateToken(req: Request): string | null {
  const url = new URL(req.url);
  const token = req.headers.get(TOKEN_HEADER) ?? url.searchParams.get("token");
  const trimmed = token?.trim();
  return trimmed && trimmed.length >= 16 ? trimmed : null;
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const {
    plaidAccessToken: _plaidAccessToken,
    chatHistory: _chatHistory,
    ...safeState
  } = state;

  return safeState;
}

function stateFileForToken(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex");
  return path.join(STATE_DIR, `${digest}.json`);
}

export async function readServerState(token: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(stateFileForToken(token), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeServerState(token: string, state: Record<string, unknown>): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const stateFile = stateFileForToken(token);
  const tempFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(sanitizeServerState(state)), "utf-8");
  await fs.rename(tempFile, stateFile);
}
