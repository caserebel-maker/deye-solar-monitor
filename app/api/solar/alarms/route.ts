import { NextResponse } from "next/server";
import { getSolarAlarms } from "@/lib/deye-api";

export async function GET() {
  try {
    return NextResponse.json(await getSolarAlarms());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
