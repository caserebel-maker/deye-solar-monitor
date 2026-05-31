import { NextResponse } from "next/server";
import { deyePost } from "@/lib/deye-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, any> = {};
  const stationId = Number(process.env.DEYE_STATION_ID);
  
  // Test 1: Get raw station latest
  try {
    results.latest = await deyePost("/v1.0/station/latest", { stationId });
  } catch (err: any) {
    results.latestError = err.message || err;
  }

  // Test 2: Get station history (Month-to-date)
  try {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateString = (date: Date) => date.toISOString().slice(0, 10);
    
    results.historyParams = {
      stationId,
      granularity: 2,
      startAt: dateString(monthStart),
      endAt: dateString(nextDay),
    };

    results.history = await deyePost("/v1.0/station/history", results.historyParams);
  } catch (err: any) {
    results.historyError = err.message || err;
  }

  return NextResponse.json(results);
}
