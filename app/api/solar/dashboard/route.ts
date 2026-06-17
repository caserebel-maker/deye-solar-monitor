import { NextResponse } from "next/server";
import { getSolarAlarms, getSolarHistory, getSolarOverview } from "@/lib/deye-api";
import { getWeatherForecast } from "@/lib/weather";

const headers = {
  "Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
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
