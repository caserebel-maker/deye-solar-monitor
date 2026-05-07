import { NextResponse } from "next/server";
import { getSolarHistory } from "@/lib/deye-api";

export async function GET() {
  try {
    return NextResponse.json(await getSolarHistory());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
