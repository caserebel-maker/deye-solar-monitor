import { NextResponse } from "next/server";

// Server-only: forwards PTZ commands from the dashboard to the home Mac
// mini's PTZ proxy via Tailscale Funnel. The bearer token never touches
// the browser — it lives in CCTV_PTZ_TOKEN (encrypted Vercel env).

const ALLOWED_DIRECTIONS = new Set([
  "up",
  "down",
  "left",
  "right",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
  "stop",
]);

export async function POST(request: Request) {
  const endpoint = process.env.CCTV_PTZ_ENDPOINT;
  const token = process.env.CCTV_PTZ_TOKEN;

  if (!endpoint || !token) {
    return NextResponse.json(
      { error: "PTZ env not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const payload = body as {
    direction?: string;
    duration_ms?: number;
    velocity?: number;
  };

  if (!payload.direction || !ALLOWED_DIRECTIONS.has(payload.direction)) {
    return NextResponse.json({ error: "invalid direction" }, { status: 400 });
  }

  const duration = clamp(payload.duration_ms ?? 400, 50, 2000);
  const velocity = clamp(payload.velocity ?? 0.4, 0.05, 1.0);

  try {
    const upstream = await fetch(`${endpoint}/ptz`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction: payload.direction,
        duration_ms: duration,
        velocity,
      }),
      // Important: don't cache PTZ calls
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "ptz upstream unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
