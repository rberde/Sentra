import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    check: "liquidity_monitor",
    timestamp: new Date().toISOString(),
    data: {
      cashBuffer: 0,
      fixedExpensesMonthly: 0,
      monthsOfCoverage: 0,
      threshold: 1,
      alert: false,
      alertLevel: null,
      message: "No active profile for liquidity monitoring.",
    },
  });
}
