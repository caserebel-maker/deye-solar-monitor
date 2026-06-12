import { NextResponse } from "next/server";
import { getSolarOverview } from "@/lib/deye-api";

export async function GET() {
  try {
    return NextResponse.json(await getSolarOverview(), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "s-maxage=55, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
