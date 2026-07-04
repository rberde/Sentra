const SYNC_TOKEN_KEY = "pfre_sync_token";

export function getOrCreateSyncToken(): string {
  if (typeof window === "undefined") return "";

  const existing = localStorage.getItem(SYNC_TOKEN_KEY);
  if (existing) return existing;

  const token = crypto.randomUUID();
  localStorage.setItem(SYNC_TOKEN_KEY, token);
  return token;
}
