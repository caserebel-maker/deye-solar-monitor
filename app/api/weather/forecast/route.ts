import { NextResponse } from "next/server";
import { getWeatherForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const forecast = await getWeatherForecast();
  return NextResponse.json(forecast);
}
