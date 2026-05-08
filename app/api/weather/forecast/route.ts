import { NextResponse } from "next/server";
import { getWeatherForecast } from "@/lib/weather";

export const revalidate = 600;

export async function GET() {
  const forecast = await getWeatherForecast();
  return NextResponse.json(forecast);
}
