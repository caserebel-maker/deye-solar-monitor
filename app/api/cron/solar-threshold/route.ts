// Vercel Cron — periodic Telegram status update
//
// Schedule: every 30 min (configured in vercel.json)
//   - กลางวัน Bangkok 06:00-19:00 → ส่ง status update พร้อม indicator ▲/▼ vs threshold
//   - กลางคืน → skip (solar = 0, ไม่มีอะไรให้รายงาน)
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

const DEFAULT_THRESHOLD_KW = 2.5;
const DEFAULT_DAYLIGHT_START_HR = 6;   // Bangkok time
const DEFAULT_DAYLIGHT_END_HR = 19;    // Bangkok time (exclusive — last fire at 18:30)
const PROD_URL = "https://monitor-solar-inverter-deye-battery.vercel.app";
const BANGKOK_OFFSET_HRS = 7;

function getThreshold(): number {
  const raw = process.env.SOLAR_ALERT_THRESHOLD_KW;
  if (!raw) return DEFAULT_THRESHOLD_KW;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_KW;
}

function getDaylightWindow(): { start: number; end: number } {
  const start = Number(process.env.SOLAR_ALERT_HOUR_START ?? DEFAULT_DAYLIGHT_START_HR);
  const end = Number(process.env.SOLAR_ALERT_HOUR_END ?? DEFAULT_DAYLIGHT_END_HR);
  return {
    start: Number.isFinite(start) ? start : DEFAULT_DAYLIGHT_START_HR,
    end: Number.isFinite(end) ? end : DEFAULT_DAYLIGHT_END_HR,
  };
}

function bangkokHour(): number {
  // Vercel runs UTC. Convert to Bangkok (UTC+7) without DST drama.
  const utcHour = new Date().getUTCHours();
  return (utcHour + BANGKOK_OFFSET_HRS) % 24;
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
  const hour = bangkokHour();
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && (hour < start || hour >= end)) {
    return NextResponse.json({
      ok: true,
      skipped: "outside daylight window",
      bangkokHour: hour,
      window: `${start}:00–${end}:00`,
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
      bangkokHour: hour,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("solar-threshold cron failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
