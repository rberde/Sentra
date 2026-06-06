import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const MONITOR_API_KEY_ENV = "PFRE_MONITOR_API_KEY";

export function requireMonitorApiKey(req: Request): NextResponse | null {
  const expected = process.env[MONITOR_API_KEY_ENV];
  if (!expected) {
    return NextResponse.json(
      { error: `${MONITOR_API_KEY_ENV} must be configured before monitoring endpoints are available` },
      { status: 503 },
    );
  }

  const token = getBearerToken(req.headers.get("authorization")) ?? req.headers.get("x-pfre-monitor-key");
  if (!token || !safeEqual(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function getBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
