import { NextResponse } from "next/server";
import { getSolarAlarms, getSolarHistory, getSolarOverview } from "@/lib/deye-api";
import { getWeatherForecast } from "@/lib/weather";

const headers = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "s-maxage=55, stale-while-revalidate=120",
};

export async function GET() {
  try {
    const [overview, history, alarms, weather] = await Promise.all([
      getSolarOverview(),
      getSolarHistory(),
      getSolarAlarms(),
      getWeatherForecast(),
    ]);

    return NextResponse.json({ overview, history, alarms, weather }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
