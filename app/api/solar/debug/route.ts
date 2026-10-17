import { NextResponse } from "next/server";
import { getRawStationLatest, getSolarOverview, deyePost, getConfig } from "@/lib/deye-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  const stationId = Number(config.stationId);
  const deviceId = config.deviceId ? Number(config.deviceId) : undefined;

  const [raw, overview, listWithDevice, stationDetail, alertList, deviceLatestByDeviceId, deviceLatestByLoggerSn] = await Promise.allSettled([
    getRawStationLatest(),
    getSolarOverview(),
    deyePost("/v1.0/station/listWithDevice", { page: 1, size: 10 }),
    deyePost("/v1.0/station/detail", { stationId }),
    deyePost("/v1.0/station/alertList", { stationId }),
    deyePost("/v1.0/device/latest", { deviceList: [String(config.deviceId ?? "2409134407")] }),
    deyePost("/v1.0/device/latest", { deviceList: [String(config.loggerSn ?? "3117271959")] }),
  ]);

  return NextResponse.json(
    {
      currentTime: new Date().toISOString(),
      rawStationLatest: raw.status === "fulfilled" ? raw.value : { error: String(raw.reason) },
      derivedOverview: overview.status === "fulfilled" ? overview.value : { error: String(overview.reason) },
      listWithDevice: listWithDevice.status === "fulfilled" ? listWithDevice.value : { error: String(listWithDevice.reason) },
      stationDetail: stationDetail.status === "fulfilled" ? stationDetail.value : { error: String(stationDetail.reason) },
      alertList: alertList.status === "fulfilled" ? alertList.value : { error: String(alertList.reason) },
      deviceLatestByDeviceId: deviceLatestByDeviceId.status === "fulfilled" ? deviceLatestByDeviceId.value : { error: String(deviceLatestByDeviceId.reason) },
      deviceLatestByLoggerSn: deviceLatestByLoggerSn.status === "fulfilled" ? deviceLatestByLoggerSn.value : { error: String(deviceLatestByLoggerSn.reason) },
    },
    { status: 200 },
  );
}
