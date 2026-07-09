export function hasStateSyncToken(token: string | null | undefined): token is string {
  return !!token?.trim();
}

export function getStateSyncHeaders(
  token: string | null | undefined,
  headers: Record<string, string> = {},
): Record<string, string> {
  const syncToken = token?.trim();
  if (!syncToken) return headers;

  return {
    ...headers,
    "x-pfre-sync-token": syncToken,
  };
}
