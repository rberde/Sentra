import { NextResponse } from "next/server";
import { deleteServerState, getServerStateToken, readServerState, writeServerState } from "@/lib/server-state";

function unauthorized() {
  return NextResponse.json({ error: "Missing or invalid sync token" }, { status: 401 });
}

export async function POST(req: Request) {
  try {
    const token = getServerStateToken(req);
    if (!token) return unauthorized();

    const body = await req.json();
    await writeServerState(token, body);
    return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State sync error:", error);
    return NextResponse.json({ error: "Failed to sync state" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const token = getServerStateToken(req);
  if (!token) return unauthorized();

  const state = await readServerState(token);
  if (!state) {
    return NextResponse.json({ error: "No state synced yet" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", lastSyncedAt: state.lastSyncedAt ?? null });
}

export async function DELETE(req: Request) {
  const token = getServerStateToken(req);
  if (!token) return unauthorized();

  await deleteServerState(token);
  return NextResponse.json({ status: "ok" });
}
