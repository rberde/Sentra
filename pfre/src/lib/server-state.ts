import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

const STATE_DIR = path.join(process.cwd(), ".pfre-state");
const TOKEN_HEADER = "x-pfre-sync-token";

/**
 * Server-side state store. The client periodically syncs its localStorage
 * state here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser.
 */

export function getStateToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length)
    : null;
  const urlToken = new URL(req.url).searchParams.get("token");
  const token = req.headers.get(TOKEN_HEADER) ?? bearerToken ?? urlToken;
  const normalized = token?.trim();

  return normalized && normalized.length >= 16 ? normalized : null;
}

export function sanitizeServerState(state: Record<string, unknown>): Record<string, unknown> {
  const safeState = { ...state };
  delete safeState.chatHistory;
  delete safeState.plaidAccessToken;

  return safeState;
}

function stateFileForToken(token: string): string {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return path.join(STATE_DIR, `${tokenHash}.json`);
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
  const file = stateFileForToken(token);
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(sanitizeServerState(state)), "utf-8");
  await fs.rename(tempFile, file);
}
