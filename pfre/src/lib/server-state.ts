import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { normalizeSyncToken, STATE_SYNC_TOKEN_HEADER } from "@/lib/sync-token";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export function getStateSyncToken(req: Request): string | null {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  return normalizeSyncToken(
    req.headers.get(STATE_SYNC_TOKEN_HEADER) ??
      req.headers.get("x-pfre-api-key") ??
      bearerToken ??
      url.searchParams.get("token"),
  );
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const { chatHistory: _chatHistory, plaidAccessToken: _plaidAccessToken, ...syncable } = state;

  return {
    ...syncable,
    plaidAccessToken: null,
  };
}

export async function readServerState(syncToken: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(stateFileForToken(syncToken), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeServerState(syncToken: string, state: Record<string, unknown>): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });

  const stateFile = stateFileForToken(syncToken);
  const tmpFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(sanitizeServerState(state)), { encoding: "utf-8", mode: 0o600 });
  await fs.rename(tmpFile, stateFile);
}

function stateFileForToken(syncToken: string): string {
  const tokenHash = createHash("sha256").update(syncToken).digest("hex");
  return path.join(STATE_DIR, `${tokenHash}.json`);
}
