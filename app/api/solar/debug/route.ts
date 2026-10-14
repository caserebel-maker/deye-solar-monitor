import { NextResponse } from "next/server";
import { getRawStationLatest, getSolarOverview, deyePost, getConfig } from "@/lib/deye-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  const stationId = Number(config.stationId);
  const deviceId = config.deviceId ? Number(config.deviceId) : undefined;

  const [raw, overview, deviceList, stationDetail, alertList, deviceLatest] = await Promise.allSettled([
    getRawStationLatest(),
    getSolarOverview(),
    deyePost("/v1.0/station/deviceList", { stationId }),
    deyePost("/v1.0/station/detail", { stationId }),
    deyePost("/v1.0/station/alertList", { stationId }),
    deviceId ? deyePost("/v1.0/device/latest", { deviceId }) : Promise.resolve(null),
  ]);

  return NextResponse.json(
    {
      currentTime: new Date().toISOString(),
      rawStationLatest: raw.status === "fulfilled" ? raw.value : { error: String(raw.reason) },
      derivedOverview: overview.status === "fulfilled" ? overview.value : { error: String(overview.reason) },
      deviceList: deviceList.status === "fulfilled" ? deviceList.value : { error: String(deviceList.reason) },
      stationDetail: stationDetail.status === "fulfilled" ? stationDetail.value : { error: String(stationDetail.reason) },
      alertList: alertList.status === "fulfilled" ? alertList.value : { error: String(alertList.reason) },
      deviceLatest: deviceLatest.status === "fulfilled" ? deviceLatest.value : { error: String(deviceLatest.reason) },
    },
    { status: 200 },
  );
}
