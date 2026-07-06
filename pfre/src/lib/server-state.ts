import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");
const MIN_SYNC_TOKEN_LENGTH = 16;

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export function getServerStateToken(req: Request): string | null {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = req.headers.get("x-pfre-sync-token") ?? bearerToken ?? url.searchParams.get("token");
  const trimmed = token?.trim();

  if (!trimmed || trimmed.length < MIN_SYNC_TOKEN_LENGTH) {
    return null;
  }

  return trimmed;
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const safeState = { ...state };
  delete safeState.chatHistory;
  delete safeState.plaidAccessToken;
  delete safeState.syncToken;
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
  await fs.writeFile(stateFileForToken(token), JSON.stringify(sanitizeServerState(state)), "utf-8");
}

export async function deleteServerState(token: string): Promise<void> {
  try {
    await fs.unlink(stateFileForToken(token));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
