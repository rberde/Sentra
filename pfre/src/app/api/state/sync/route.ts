import { NextResponse } from "next/server";
import { authorizeStateRequest, writeServerState, readServerState } from "@/lib/server-state";

export async function POST(req: Request) {
  const auth = authorizeStateRequest(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  try {
    const body = await req.json();
    await writeServerState(auth.token, body);
    return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State sync error:", error);
    return NextResponse.json({ error: "Failed to sync state" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = authorizeStateRequest(req);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const state = await readServerState(auth.token);
  if (!state) {
    return NextResponse.json({ error: "No state synced yet" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", lastSyncedAt: state.lastSyncedAt ?? null });
}
