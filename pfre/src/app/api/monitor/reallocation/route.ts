import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    check: "reallocation_opportunity",
    timestamp: new Date().toISOString(),
    data: {
      portfolioGrowthThisMonth: 0,
      projectedGrowth: 0,
      excessGrowth: 0,
      potentialRedirection: 0,
      alert: false,
      message: "No active plan for reallocation monitoring.",
    },
  });
}
