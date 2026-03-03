import { NextResponse } from "next/server";

/**
 * POST /api/n8n/trigger
 *
 * The client calls this after running agent checks that found breaches.
 * This endpoint forwards the alert payload to the n8n webhook
 * (configured via N8N_WEBHOOK_URL env var) for external notification routing.
 *
 * Body: { alerts: Alert[], profileName: string, planName: string }
 */
export async function POST(req: Request) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!n8nWebhookUrl) {
    return NextResponse.json({
      status: "skipped",
      reason: "N8N_WEBHOOK_URL not configured in .env.local",
    });
  }

  try {
    const body = await req.json();

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "pfre",
        timestamp: new Date().toISOString(),
        ...body,
      }),
    });

    const result = await response.json().catch(() => ({ status: response.status }));

    return NextResponse.json({
      status: "ok",
      n8nResponse: result,
      forwardedTo: n8nWebhookUrl,
    });
  } catch (error) {
    console.error("n8n trigger error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to forward to n8n webhook" },
      { status: 502 },
    );
  }
}
