import { NextResponse } from "next/server";
import { getSolarAlarms } from "@/lib/deye-api";

export async function GET() {
  try {
    return NextResponse.json(await getSolarAlarms(), {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
