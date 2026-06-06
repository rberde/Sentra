import { NextResponse } from "next/server";
import { writeServerState, readServerState } from "@/lib/server-state";
import { requireMonitorApiKey } from "@/lib/api-auth";

export async function POST(req: Request) {
  const unauthorized = requireMonitorApiKey(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    await writeServerState(body);
    return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State sync error:", error);
    return NextResponse.json({ error: "Failed to sync state" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const unauthorized = requireMonitorApiKey(req);
  if (unauthorized) return unauthorized;

  const state = await readServerState();
  if (!state) {
    return NextResponse.json({ error: "No state synced yet" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", lastSyncedAt: state.lastSyncedAt ?? null });
}
