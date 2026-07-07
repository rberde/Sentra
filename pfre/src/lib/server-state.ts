import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID, timingSafeEqual } from "crypto";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");
export const STATE_TOKEN_HEADER = "x-pfre-sync-token";

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export type StateAuthResult =
  | { ok: true; token: string }
  | { ok: false; status: 401 | 503; body: { error: string } };

function configuredStateToken(): string | null {
  return process.env.PFRE_SYNC_TOKEN || process.env.NEXT_PUBLIC_PFRE_SYNC_TOKEN || null;
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getRequestStateToken(req: Request): string | null {
  const headerToken = req.headers.get(STATE_TOKEN_HEADER)?.trim();
  if (headerToken) return headerToken;

  const auth = req.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const bearerToken = auth.slice("bearer ".length).trim();
    if (bearerToken) return bearerToken;
  }

  const queryToken = new URL(req.url).searchParams.get("token")?.trim();
  return queryToken || null;
}

export function authorizeStateRequest(req: Request): StateAuthResult {
  const expectedToken = configuredStateToken();
  if (!expectedToken) {
    return {
      ok: false,
      status: 503,
      body: { error: "PFRE_SYNC_TOKEN is not configured" },
    };
  }

  const requestToken = getRequestStateToken(req);
  if (!requestToken || !safeTokenEquals(requestToken, expectedToken)) {
    return {
      ok: false,
      status: 401,
      body: { error: "Missing or invalid sync token" },
    };
  }

  return { ok: true, token: requestToken };
}

function stateFileForToken(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex");
  return path.join(STATE_DIR, `${digest}.json`);
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const { chatHistory: _chatHistory, plaidAccessToken: _plaidAccessToken, ...safeState } = state;
  return safeState;
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
  const tempFile = path.join(STATE_DIR, `${path.basename(stateFile)}.${randomUUID()}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(sanitizeServerState(state)), "utf-8");
  await fs.rename(tempFile, stateFile);
}
