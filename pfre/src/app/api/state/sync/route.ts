import { NextResponse } from "next/server";
import { getStateToken, writeServerState, readServerState } from "@/lib/server-state";

export async function POST(req: Request) {
  const token = getStateToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid sync token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    await writeServerState(token, body);
    return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State sync error:", error);
    return NextResponse.json({ error: "Failed to sync state" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const token = getStateToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid sync token" }, { status: 401 });
  }

  const state = await readServerState(token);
  if (!state) {
    return NextResponse.json({ error: "No state synced yet" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", lastSyncedAt: state.lastSyncedAt ?? null });
}
