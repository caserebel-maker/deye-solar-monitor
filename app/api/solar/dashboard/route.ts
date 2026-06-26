import { NextResponse } from "next/server";
import { getSolarAlarms, getSolarHistory, getSolarOverview } from "@/lib/deye-api";
import { getWeatherForecast } from "@/lib/weather";

// ISR: Vercel caches the response for 60 seconds. Multiple clients polling
// within that window get served from cache — only one function invocation per
// 60-second window regardless of how many browsers are open.
export const revalidate = 60;

export async function GET() {
  try {
    const [overview, history, alarms, weather] = await Promise.all([
      getSolarOverview(),
      getSolarHistory(),
      getSolarAlarms(),
      getWeatherForecast(),
    ]);

    return NextResponse.json({ overview, history, alarms, weather });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
