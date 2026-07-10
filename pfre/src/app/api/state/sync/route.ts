import { NextResponse } from "next/server";
import { deleteServerState, writeServerState, readServerState } from "@/lib/server-state";
import { requireSyncAuth } from "@/lib/sync-auth";

export async function POST(req: Request) {
  const auth = requireSyncAuth(req);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    await writeServerState(body, auth.token);
    return NextResponse.json({ status: "ok", syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State sync error:", error);
    return NextResponse.json({ error: "Failed to sync state" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = requireSyncAuth(req);
  if ("response" in auth) return auth.response;

  const state = await readServerState(auth.token);
  if (!state) {
    return NextResponse.json({ error: "No state synced yet" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", lastSyncedAt: state.lastSyncedAt ?? null });
}

export async function DELETE(req: Request) {
  const auth = requireSyncAuth(req);
  if ("response" in auth) return auth.response;

  try {
    await deleteServerState(auth.token);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("State delete error:", error);
    return NextResponse.json({ error: "Failed to clear state" }, { status: 500 });
  }
}
