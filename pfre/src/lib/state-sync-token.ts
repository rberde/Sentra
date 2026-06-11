const SYNC_TOKEN_KEY = "pfre_state_sync_token";

function createSyncToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function getStateSyncToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = localStorage.getItem(SYNC_TOKEN_KEY);
  if (existing) {
    return existing;
  }

  const token = createSyncToken();
  localStorage.setItem(SYNC_TOKEN_KEY, token);
  return token;
}

export function stateSyncAuthHeaders(): Record<string, string> {
  const token = getStateSyncToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
