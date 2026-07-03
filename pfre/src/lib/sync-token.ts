export const STATE_SYNC_TOKEN_HEADER = "x-pfre-sync-token";

const MIN_SYNC_TOKEN_LENGTH = 32;
const MAX_SYNC_TOKEN_LENGTH = 256;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function normalizeSyncToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim();

  if (
    !trimmed ||
    trimmed.length < MIN_SYNC_TOKEN_LENGTH ||
    trimmed.length > MAX_SYNC_TOKEN_LENGTH ||
    !TOKEN_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}
