import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";

const STATE_TOKEN_MIN_LENGTH = 32;
const LEGACY_STATE_FILE = path.join(process.cwd(), ".pfre-state.json");

/**
 * Server-side state store. The client periodically syncs a sanitized snapshot
 * here so that server-side API routes (called by n8n) can evaluate
 * notification rules without needing the browser. State is partitioned by a
 * bearer token so unauthenticated clients cannot overwrite/read a global file.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidOptionalArray(container: Record<string, unknown>, key: string): boolean {
  return container[key] === undefined || Array.isArray(container[key]);
}

function stateFileForToken(token: string): string {
  const digest = crypto.createHash("sha256").update(token).digest("hex");
  return path.join(process.cwd(), `.pfre-state-${digest}.json`);
}

export function getStateSyncToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const bearerToken = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerToken = req.headers.get("x-pfre-sync-token")?.trim();
  const token = bearerToken || headerToken;

  if (!token || token.length < STATE_TOKEN_MIN_LENGTH) {
    return null;
  }

  return token;
}

export function sanitizeServerState(state: unknown): Record<string, unknown> | null {
  if (!isRecord(state)) {
    return null;
  }

  const profile = state.profile;
  if (profile !== undefined && profile !== null) {
    if (!isRecord(profile)) {
      return null;
    }

    if (
      !isValidOptionalArray(profile, "incomeStreams") ||
      !isValidOptionalArray(profile, "fixedExpenses") ||
      !isValidOptionalArray(profile, "variableExpenses")
    ) {
      return null;
    }
  }

  if (
    !isValidOptionalArray(state, "riskEvents") ||
    !isValidOptionalArray(state, "rebalancingPlans") ||
    !isValidOptionalArray(state, "notifications") ||
    !isValidOptionalArray(state, "plaidAccounts")
  ) {
    return null;
  }

  const notificationSettings = state.notificationSettings;
  if (notificationSettings !== undefined && notificationSettings !== null) {
    if (!isRecord(notificationSettings) || !isValidOptionalArray(notificationSettings, "rules")) {
      return null;
    }
  }

  const sanitized = { ...state };
  delete sanitized.chatHistory;
  delete sanitized.plaidAccessToken;

  return sanitized;
}

export async function readServerState(token: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(stateFileForToken(token), "utf-8");
    return sanitizeServerState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeServerState(token: string, state: Record<string, unknown>): Promise<void> {
  const sanitized = sanitizeServerState(state);
  if (!sanitized) {
    throw new Error("Invalid server state payload");
  }

  const stateFile = stateFileForToken(token);
  const tempFile = `${stateFile}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(sanitized), "utf-8");
  await fs.rename(tempFile, stateFile);
  await fs.rm(LEGACY_STATE_FILE, { force: true });
}
