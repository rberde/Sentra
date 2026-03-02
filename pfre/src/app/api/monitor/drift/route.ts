import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    check: "drift_detection",
    timestamp: new Date().toISOString(),
    data: {
      planActive: false,
      categories: [],
      overallDrift: 0,
      threshold: 10,
      alert: false,
      message: "No active plan for drift detection.",
    },
  });
}
