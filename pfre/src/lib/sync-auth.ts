import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const SYNC_TOKEN_HEADER = "x-pfre-sync-token";

function configuredSyncToken(): string {
  return process.env.PFRE_SYNC_TOKEN?.trim() ?? "";
}

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function getRequestSyncToken(req: Request): string | null {
  const headerToken = req.headers.get(SYNC_TOKEN_HEADER)?.trim();
  if (headerToken) return headerToken;

  const authorization = req.headers.get("authorization")?.trim();
  const bearerPrefix = "Bearer ";
  if (authorization?.startsWith(bearerPrefix)) {
    const bearerToken = authorization.slice(bearerPrefix.length).trim();
    if (bearerToken) return bearerToken;
  }

  return null;
}

export function requireSyncAuth(req: Request): { token: string } | { response: NextResponse } {
  const expectedToken = configuredSyncToken();
  if (!expectedToken) {
    return {
      response: NextResponse.json(
        { error: "PFRE_SYNC_TOKEN is not configured" },
        { status: 503 },
      ),
    };
  }

  const suppliedToken = getRequestSyncToken(req);
  if (!suppliedToken || !safeEquals(suppliedToken, expectedToken)) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  return { token: suppliedToken };
}
