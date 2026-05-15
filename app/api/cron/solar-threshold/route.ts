// Vercel Cron — periodic Telegram status update
//
// Schedule: every 30 min (configured in vercel.json)
//   - กลางวัน Bangkok 07:30–16:30 (inclusive) → ส่ง status update พร้อม indicator ▲/▼ vs threshold
//   - นอกช่วง → skip (solar น้อย/0, ไม่มีอะไรให้รายงาน)
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
//   ถ้า CRON_SECRET ไม่ตรง → 401
//   ถ้าไม่ได้ตั้ง CRON_SECRET → ปล่อยให้ทำงาน (สำหรับ manual test ผ่าน curl)

import { NextResponse } from "next/server";
import { getSolarOverview, type SolarOverview } from "@/lib/deye-api";
import { sendTelegramMessage } from "@/lib/telegram";

// Always run — ไม่ cache cron route
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_THRESHOLD_KW = 4.0;
const DEFAULT_START_MINUTES = 7 * 60 + 30;   // 07:30 Bangkok
const DEFAULT_END_MINUTES = 16 * 60 + 30;    // 16:30 Bangkok (inclusive)
const PROD_URL = "https://monitor-solar-inverter-deye-battery.vercel.app";
const BANGKOK_OFFSET_MIN = 7 * 60;

function getThreshold(): number {
  const raw = process.env.SOLAR_ALERT_THRESHOLD_KW;
  if (!raw) return DEFAULT_THRESHOLD_KW;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_KW;
}

// "HH:MM" → minutes since midnight. Also accepts "HH" or "HH.HH".
// ส่งกลับ null ถ้า parse ไม่ได้ — caller ใช้ default
function parseTimeToMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
    return null;
  }
  const decimal = Number(trimmed);
  if (Number.isFinite(decimal) && decimal >= 0 && decimal <= 24) {
    return Math.round(decimal * 60);
  }
  return null;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDaylightWindow(): { start: number; end: number } {
  return {
    start: parseTimeToMinutes(process.env.SOLAR_ALERT_TIME_START) ?? DEFAULT_START_MINUTES,
    end: parseTimeToMinutes(process.env.SOLAR_ALERT_TIME_END) ?? DEFAULT_END_MINUTES,
  };
}

function bangkokMinutes(): number {
  // Vercel runs UTC. Convert to Bangkok (UTC+7) without DST drama.
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + BANGKOK_OFFSET_MIN) % (24 * 60);
}

function authorize(req: Request): { ok: true } | { ok: false; reason: string } {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("CRON_SECRET not set — endpoint open to public");
    return { ok: true };
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return { ok: false, reason: "invalid Bearer token" };
  }
  return { ok: true };
}

function formatStatus(overview: SolarOverview, threshold: number): string {
  const { solarKw, todayProductionKwh, batterySoc, loadKw } = overview.metrics;
  const isOver = solarKw >= threshold;
  const arrow = isOver ? "▲" : "▼";
  const headerEmoji = isOver ? "☀️" : "🌤️";
  const headerText = isOver
    ? `*Solar > ${threshold.toFixed(1)} kW*`
    : `*Solar < ${threshold.toFixed(1)} kW*`;

  const surplus = solarKw - loadKw;
  const lines: string[] = [
    `${headerEmoji} ${headerText}`,
    ``,
    `⚡ ตอนนี้ผลิต *${solarKw.toFixed(2)} kW* ${arrow}`,
    `🏠 บ้านใช้ *${loadKw.toFixed(2)} kW*`,
  ];

  if (surplus > 0.05) {
    lines.push(`💡 Surplus *${surplus.toFixed(2)} kW* — เปิดเครื่องใช้ไฟได้`);
  } else if (surplus < -0.05) {
    lines.push(`📥 Import *${Math.abs(surplus).toFixed(2)} kW* — ดึงไฟจาก grid/battery`);
  }

  lines.push(
    `📊 วันนี้สะสม *${todayProductionKwh.toFixed(1)} kWh*`,
    `🔋 Battery *${Math.round(batterySoc)}%*`,
    ``,
    `[เปิด dashboard](${PROD_URL}/)`,
  );
  return lines.join("\n");
}

export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const threshold = getThreshold();
  const { start, end } = getDaylightWindow();
  const minutes = bangkokMinutes();
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && (minutes < start || minutes > end)) {
    return NextResponse.json({
      ok: true,
      skipped: "outside daylight window",
      bangkokTime: formatMinutes(minutes),
      window: `${formatMinutes(start)}–${formatMinutes(end)}`,
    });
  }

  try {
    const overview = await getSolarOverview();
    const power = overview.metrics.solarKw;

    if (overview.source !== "live") {
      return NextResponse.json({
        ok: true,
        skipped: "non-live data source",
        source: overview.source,
        power,
        threshold,
      });
    }

    const message = formatStatus(overview, threshold);
    await sendTelegramMessage(message, { parseMode: "Markdown" });

    return NextResponse.json({
      ok: true,
      sent: true,
      power,
      threshold,
      state: power >= threshold ? "over" : "under",
      bangkokTime: formatMinutes(minutes),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("solar-threshold cron failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
