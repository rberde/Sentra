import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    status: "ok",
    check: "scheduled_checkin",
    timestamp: new Date().toISOString(),
    data: {
      planActive: false,
      daysSincePlanActivation: 0,
      nextCheckinDue: false,
      message: "No active plan for scheduled check-in.",
    },
  });
}
