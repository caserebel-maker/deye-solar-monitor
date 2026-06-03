import { NextResponse } from "next/server";

type ServerStatus = {
  id: string;
  name: string;
  role: string;
  status: "online" | "warning" | "offline";
  temperatureC: number | null;
  maxSensor: string | null;
  fanRpm: number | null;
  detail: string;
  updatedAt: string;
};

const ubuntuHealthUrl =
  process.env.UBUNTU_MACMINI_HEALTH_URL ?? "https://pond-server.tail5092c8.ts.net/pond-health/json";
const m2HealthUrl =
  process.env.M2PRO_MACMINI_HEALTH_URL ?? "https://home-macmini.tail1d5579.ts.net/control/healthz";

export const revalidate = 60;

export async function GET() {
  const [ubuntu, m2pro] = await Promise.all([
    readUbuntuStatus(),
    readM2ProStatus(),
  ]);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    servers: [ubuntu, m2pro],
  });
}

async function readUbuntuStatus(): Promise<ServerStatus> {
  try {
    const response = await fetch(ubuntuHealthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json() as {
      hostname?: string;
      time?: string;
      uptime?: string;
      sensors?: string;
    };
    const parsed = parseSensors(data.sensors ?? "");
    const temperatureC = parsed.cpu?.value ?? parsed.max?.value ?? null;
    const hotspot = parsed.max && parsed.cpu && parsed.max.name !== parsed.cpu.name
      ? ` · hotspot ${parsed.max.name} ${Math.round(parsed.max.value)}°`
      : "";
    return {
      id: "ubuntu-macmini",
      name: "Mac mini Ubuntu",
      role: data.hostname ?? "pond-server",
      status: (parsed.max?.value ?? temperatureC ?? 0) >= 85 ? "warning" : "online",
      temperatureC,
      maxSensor: parsed.cpu?.name ?? parsed.max?.name ?? null,
      fanRpm: parsed.fanRpm,
      detail: `${data.uptime ?? "Health endpoint online"}${hotspot}`,
      updatedAt: data.time ?? new Date().toISOString(),
    };
  } catch (error) {
    return offlineStatus("ubuntu-macmini", "Mac mini Ubuntu", "pond-server", error);
  }
}

async function readM2ProStatus(): Promise<ServerStatus> {
  try {
    const response = await fetch(m2HealthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json() as {
      ok?: boolean;
      temperatureC?: number;
      tempC?: number;
      sensors?: string;
      cameras_connected?: string[];
    };
    const parsed = parseSensors(data.sensors ?? "");
    const temperatureC = numeric(data.temperatureC ?? data.tempC ?? parsed.max?.value);
    return {
      id: "m2pro-macmini",
      name: "Mac mini M2 Pro",
      role: "home-macmini",
      status: data.ok === false ? "offline" : "online",
      temperatureC,
      maxSensor: parsed.max?.name ?? (temperatureC !== null ? "CPU" : null),
      fanRpm: parsed.fanRpm,
      detail: data.cameras_connected?.length
        ? `CCTV online · ${data.cameras_connected.join(", ")}`
        : "Online · temp unavailable",
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return offlineStatus("m2pro-macmini", "Mac mini M2 Pro", "home-macmini", error);
  }
}

function offlineStatus(id: string, name: string, role: string, error: unknown): ServerStatus {
  return {
    id,
    name,
    role,
    status: "offline",
    temperatureC: null,
    maxSensor: null,
    fanRpm: null,
    detail: error instanceof Error ? error.message : "unreachable",
    updatedAt: new Date().toISOString(),
  };
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSensors(text: string) {
  const readings: Array<{ name: string; value: number }> = [];
  let fanRpm: number | null = null;

  for (const line of text.split("\n")) {
    const fan = line.match(/^Exhaust\s*:\s*([0-9]+)\s+RPM/);
    if (fan) fanRpm = Number(fan[1]);

    const temp = line.match(/^\s*([A-Za-z0-9 _-]+):\s+\+?([0-9.]+)°C/);
    if (!temp) continue;
    const name = temp[1].trim();
    if (!name || name.startsWith("(")) continue;
    readings.push({ name, value: Number(temp[2]) });
  }

  const max = readings.reduce<{ name: string; value: number } | null>((current, next) => {
    if (!current || next.value > current.value) return next;
    return current;
  }, null);
  const coreReadings = readings.filter((reading) => /^Core \d+$/i.test(reading.name));
  const cpuReadings = coreReadings.length > 0
    ? coreReadings
    : readings.filter((reading) => /^(TC0D|TC0P|TC0G|TCPG|Tp0C)$/i.test(reading.name));
  const cpu = cpuReadings.reduce<{ name: string; value: number } | null>((current, next) => {
    if (!current || next.value > current.value) return next;
    return current;
  }, null);

  return { max, cpu, fanRpm };
}
