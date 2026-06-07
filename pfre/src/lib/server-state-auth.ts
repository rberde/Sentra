import { timingSafeEqual } from "crypto";

export const STATE_SYNC_TOKEN_HEADER = "x-pfre-state-token";

function configuredStateToken(): string | null {
  const token = process.env.PFRE_STATE_SYNC_TOKEN?.trim();
  return token ? token : null;
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function tokensMatch(expected: string, provided: string | null): boolean {
  if (!provided) return false;

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided.trim());

  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export function isAuthorizedServerStateRequest(req: Request): boolean {
  const expected = configuredStateToken();

  if (!expected) {
    return false;
  }

  const headerToken = req.headers.get(STATE_SYNC_TOKEN_HEADER);

  return tokensMatch(expected, headerToken) || tokensMatch(expected, bearerToken(req));
}
