import { NextResponse } from "next/server";
import { getSolarOverview } from "@/lib/deye-api";

export async function GET() {
  try {
    return NextResponse.json(await getSolarOverview());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
