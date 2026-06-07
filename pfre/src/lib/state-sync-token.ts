export const STATE_SYNC_TOKEN_HEADER = "x-pfre-state-token";

const STATE_SYNC_TOKEN_STORAGE_KEY = "pfre_state_sync_token";

export function getStoredStateSyncToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STATE_SYNC_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

export function setStoredStateSyncToken(token: string): void {
  if (typeof window === "undefined") return;

  const normalized = token.trim();
  if (normalized) {
    localStorage.setItem(STATE_SYNC_TOKEN_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(STATE_SYNC_TOKEN_STORAGE_KEY);
  }
}

export function stateSyncHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getStoredStateSyncToken();

  if (!token) {
    return headers;
  }

  return {
    ...headers,
    [STATE_SYNC_TOKEN_HEADER]: token,
  };
}
