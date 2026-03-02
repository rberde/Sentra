import { NextResponse } from "next/server";

export async function GET() {
  // In production, this would read from the database.
  // For MVP, we return a mock monitoring response that n8n can consume.
  // n8n calls this endpoint daily and decides whether to create a notification.

  return NextResponse.json({
    status: "ok",
    check: "spending_monitor",
    timestamp: new Date().toISOString(),
    data: {
      planActive: false,
      variableSpendingCap: 0,
      actualSpendingThisMonth: 0,
      percentUsed: 0,
      daysRemainingInMonth: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate(),
      alert: false,
      alertLevel: null,
      message: "No active rebalancing plan. Monitoring inactive.",
    },
  });
}
