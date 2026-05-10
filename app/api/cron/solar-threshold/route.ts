// Vercel Cron — เช็คทุกชั่วโมง ถ้า solar power > threshold → ส่ง Telegram
//
// Schedule: 0 * * * *  (top of every hour)
// Configured in vercel.json
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
const PROD_URL = "https://monitor-solar-inverter-deye-battery.vercel.app";

function getThreshold(): number {
  const raw = process.env.SOLAR_ALERT_THRESHOLD_KW;
  if (!raw) return DEFAULT_THRESHOLD_KW;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_KW;
}

function authorize(req: Request): { ok: true } | { ok: false; reason: string } {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // ยังไม่ได้ตั้ง secret = อนุญาต (สำหรับ dev/test) แต่ log warning
    console.warn("CRON_SECRET not set — endpoint open to public");
    return { ok: true };
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return { ok: false, reason: "invalid Bearer token" };
  }
  return { ok: true };
}

function formatAlert(overview: SolarOverview, threshold: number): string {
  const { solarKw, todayProductionKwh, batterySoc, loadKw } = overview.metrics;
  const surplus = solarKw - loadKw;
  const surplusLine = surplus > 0 ? `\n💡 Surplus *${surplus.toFixed(2)} kW* — เปิดเครื่องใช้ไฟได้สบาย` : "";
  return [
    `☀️ *Solar ผลิตเกิน ${threshold.toFixed(1)} kW*`,
    ``,
    `⚡ ตอนนี้ผลิต *${solarKw.toFixed(2)} kW*`,
    `🏠 บ้านใช้ *${loadKw.toFixed(2)} kW*${surplusLine}`,
    `📊 วันนี้สะสม *${todayProductionKwh.toFixed(1)} kWh*`,
    `🔋 Battery *${Math.round(batterySoc)}%*`,
    ``,
    `[เปิด dashboard](${PROD_URL}/)`,
  ].join("\n");
}

export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const threshold = getThreshold();

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

    if (power < threshold) {
      return NextResponse.json({
        ok: true,
        sent: false,
        power,
        threshold,
        reason: "below threshold",
      });
    }

    const message = formatAlert(overview, threshold);
    await sendTelegramMessage(message, { parseMode: "Markdown" });

    return NextResponse.json({
      ok: true,
      sent: true,
      power,
      threshold,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("solar-threshold cron failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
