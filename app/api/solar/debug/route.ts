import { NextResponse } from "next/server";
import { getRawStationLatest, getSolarOverview, deyePost, getConfig } from "@/lib/deye-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  const stationId = Number(config.stationId);
  const deviceId = config.deviceId ? Number(config.deviceId) : undefined;

  const [raw, overview, listWithDevice, stationDetail, deviceLatestWithInverterSn, deviceMeasurePoints, stationDevice, configSystem] = await Promise.allSettled([
    getRawStationLatest(),
    getSolarOverview(),
    deyePost("/v1.0/station/listWithDevice", { page: 1, size: 10 }),
    deyePost("/v1.0/station/detail", { stationId }),
    deyePost("/v1.0/device/latest", { deviceList: ["2409134407"] }),
    deyePost("/v1.0/device/measurePoints", { deviceSn: "2409134407", deviceType: "INVERTER" }),
    deyePost("/v1.0/station/device", { stationIds: [stationId], page: 1, size: 20 }),
    deyePost("/v1.0/config/system", { deviceSn: "2409134407" }),
  ]);

  return NextResponse.json(
    {
      currentTime: new Date().toISOString(),
      rawStationLatest: raw.status === "fulfilled" ? raw.value : { error: String(raw.reason) },
      derivedOverview: overview.status === "fulfilled" ? overview.value : { error: String(overview.reason) },
      listWithDevice: listWithDevice.status === "fulfilled" ? listWithDevice.value : { error: String(listWithDevice.reason) },
      stationDetail: stationDetail.status === "fulfilled" ? stationDetail.value : { error: String(stationDetail.reason) },
      deviceLatestWithInverterSn: deviceLatestWithInverterSn.status === "fulfilled" ? deviceLatestWithInverterSn.value : { error: String(deviceLatestWithInverterSn.reason) },
      deviceMeasurePoints: deviceMeasurePoints.status === "fulfilled" ? deviceMeasurePoints.value : { error: String(deviceMeasurePoints.reason) },
      stationDevice: stationDevice.status === "fulfilled" ? stationDevice.value : { error: String(stationDevice.reason) },
      configSystem: configSystem.status === "fulfilled" ? configSystem.value : { error: String(configSystem.reason) },
    },
    { status: 200 },
  );
}
