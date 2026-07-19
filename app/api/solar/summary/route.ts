import { NextResponse } from "next/server";
import { getSolarEnergySummary } from "@/lib/deye-api";

export const revalidate = 300;

export async function GET() {
  try {
    return NextResponse.json(await getSolarEnergySummary(), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
