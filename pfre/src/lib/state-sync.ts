const SERVER_STATE_EXCLUDED_KEYS = new Set(["chatHistory", "plaidAccessToken"]);

/**
 * Server-side monitoring state must never include browser-only history or
 * long-lived third-party credentials such as Plaid access tokens.
 */
export function sanitizeServerState<T extends object>(
  state: T,
): Omit<T, "chatHistory" | "plaidAccessToken"> {
  return Object.fromEntries(
    Object.entries(state).filter(([key]) => !SERVER_STATE_EXCLUDED_KEYS.has(key)),
  ) as Omit<T, "chatHistory" | "plaidAccessToken">;
}
