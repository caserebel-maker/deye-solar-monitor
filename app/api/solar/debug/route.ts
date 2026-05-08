import { NextResponse } from "next/server";
import { getRawStationLatest, getSolarOverview } from "@/lib/deye-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const [raw, overview] = await Promise.all([getRawStationLatest(), getSolarOverview()]);
  return NextResponse.json(
    {
      rawStationLatest: raw,
      derivedOverview: overview,
    },
    { status: 200 },
  );
}
