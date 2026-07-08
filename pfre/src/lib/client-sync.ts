export const CLIENT_STATE_SYNC_TOKEN = process.env.NEXT_PUBLIC_PFRE_SYNC_TOKEN;

export function getStateSyncHeaders(headers: Record<string, string> = {}): Record<string, string> {
  if (!CLIENT_STATE_SYNC_TOKEN) return headers;
  return {
    ...headers,
    "x-pfre-sync-token": CLIENT_STATE_SYNC_TOKEN,
  };
}
