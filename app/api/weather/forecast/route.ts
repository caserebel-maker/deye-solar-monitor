import { NextResponse } from "next/server";
import { getWeatherForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const forecast = await getWeatherForecast();
  return NextResponse.json(forecast, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
