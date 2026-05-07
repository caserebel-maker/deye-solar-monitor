export type DataSource = "live" | "mock";
export type SystemStatus = "online" | "warning" | "error" | "offline";

export type SolarOverview = {
  source: DataSource;
  status: SystemStatus;
  lastUpdated: string;
  metrics: {
    solarKw: number;
    loadKw: number;
    batterySoc: number;
    batteryPowerKw: number;
    gridPowerKw: number;
    todayProductionKwh: number;
    todayLoadKwh: number;
    monthlyProductionKwh: number;
    monthlyLoadKwh: number;
  };
  flows: {
    solarToHomeKw: number;
    solarToBatteryKw: number;
    solarToGridKw: number;
    batteryToHomeKw: number;
    gridToHomeKw: number;
  };
};

export type HistoryPoint = {
  time: string;
  solarKw: number;
  loadKw: number;
  batterySoc: number;
};

export type SolarHistory = {
  source: DataSource;
  lastUpdated: string;
  dailyProduction: Array<{ day: string; kwh: number }>;
  power: HistoryPoint[];
};

export type Alarm = {
  id: string;
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  device: string;
  startedAt: string;
  resolvedAt: string | null;
};

export type SolarAlarms = {
  source: DataSource;
  lastUpdated: string;
  alarms: Alarm[];
};

type DeyeConfig = {
  baseUrl?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  stationId?: string;
  deviceId?: string;
};

const numberOr = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nowIso = () => new Date().toISOString();

function getConfig(): DeyeConfig {
  return {
    baseUrl: process.env.DEYE_API_BASE_URL,
    apiKey: process.env.DEYE_API_KEY,
    username: process.env.DEYE_USERNAME,
    password: process.env.DEYE_PASSWORD,
    stationId: process.env.DEYE_STATION_ID,
    deviceId: process.env.DEYE_DEVICE_ID,
  };
}

function hasLiveConfig(config: DeyeConfig) {
  return Boolean(config.baseUrl && config.apiKey && config.stationId);
}

function wave(seed: number, min: number, max: number) {
  const value = (Math.sin(Date.now() / 900000 + seed) + 1) / 2;
  return Number((min + value * (max - min)).toFixed(2));
}

export function mockOverview(): SolarOverview {
  const solarKw = wave(0.2, 2.8, 7.4);
  const loadKw = wave(1.7, 1.3, 5.6);
  const batteryPowerKw = Number((solarKw - loadKw - 0.4).toFixed(2));
  const gridPowerKw = Number((loadKw - solarKw - Math.min(batteryPowerKw, 0)).toFixed(2));
  const charging = Math.max(batteryPowerKw, 0);
  const discharging = Math.abs(Math.min(batteryPowerKw, 0));

  return {
    source: "mock",
    status: batteryPowerKw < -2.4 ? "warning" : "online",
    lastUpdated: nowIso(),
    metrics: {
      solarKw,
      loadKw,
      batterySoc: Math.round(wave(2.4, 54, 91)),
      batteryPowerKw,
      gridPowerKw,
      todayProductionKwh: wave(3.1, 18.2, 34.8),
      todayLoadKwh: wave(4.4, 15.6, 29.5),
      monthlyProductionKwh: wave(5.2, 612, 748),
      monthlyLoadKwh: wave(6.1, 502, 690),
    },
    flows: {
      solarToHomeKw: Math.min(solarKw, loadKw),
      solarToBatteryKw: charging,
      solarToGridKw: Math.max(solarKw - loadKw - charging, 0),
      batteryToHomeKw: discharging,
      gridToHomeKw: Math.max(gridPowerKw, 0),
    },
  };
}

export function mockHistory(): SolarHistory {
  const hours = Array.from({ length: 24 }, (_, index) => {
    const hour = String(index).padStart(2, "0");
    const daylight = Math.max(0, Math.sin(((index - 6) / 12) * Math.PI));
    return {
      time: `${hour}:00`,
      solarKw: Number((daylight * 7.2 + Math.random() * 0.35).toFixed(2)),
      loadKw: Number((1.5 + Math.sin(index / 2) * 0.6 + Math.random() * 1.1).toFixed(2)),
      batterySoc: Math.round(42 + daylight * 48 - Math.max(0, index - 18) * 2.5),
    };
  });

  return {
    source: "mock",
    lastUpdated: nowIso(),
    dailyProduction: Array.from({ length: 14 }, (_, index) => ({
      day: new Date(Date.now() - (13 - index) * 86400000).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      kwh: Number((18 + Math.sin(index / 1.8) * 8 + Math.random() * 5).toFixed(1)),
    })),
    power: hours,
  };
}

export function mockAlarms(): SolarAlarms {
  return {
    source: "mock",
    lastUpdated: nowIso(),
    alarms: [
      {
        id: "mock-warn-grid",
        level: "warning",
        code: "GRID_VOLTAGE_SWING",
        message: "Grid voltage fluctuation detected during peak export window.",
        device: "Deye Hybrid Inverter",
        startedAt: new Date(Date.now() - 38 * 60000).toISOString(),
        resolvedAt: null,
      },
      {
        id: "mock-info-cloud",
        level: "info",
        code: "CLOUD_SYNC_RESTORED",
        message: "Telemetry sync resumed after logger retry.",
        device: "WiFi Logger",
        startedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        resolvedAt: new Date(Date.now() - 3.7 * 3600000).toISOString(),
      },
    ],
  };
}

async function deyeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  if (!hasLiveConfig(config)) {
    throw new Error("Deye API credentials are not configured.");
  }

  const url = new URL(path, config.baseUrl);
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Deye API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getSolarOverview(): Promise<SolarOverview> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockOverview();

  try {
    const data = await deyeFetch<Record<string, unknown>>(`/station/${config.stationId}/overview`);
    const metrics = data.metrics as Record<string, unknown> | undefined;
    return {
      source: "live",
      status: (data.status as SystemStatus | undefined) ?? "online",
      lastUpdated: (data.lastUpdated as string | undefined) ?? nowIso(),
      metrics: {
        solarKw: numberOr(metrics?.solarKw ?? data.solarKw, 0),
        loadKw: numberOr(metrics?.loadKw ?? data.loadKw, 0),
        batterySoc: numberOr(metrics?.batterySoc ?? data.batterySoc, 0),
        batteryPowerKw: numberOr(metrics?.batteryPowerKw ?? data.batteryPowerKw, 0),
        gridPowerKw: numberOr(metrics?.gridPowerKw ?? data.gridPowerKw, 0),
        todayProductionKwh: numberOr(metrics?.todayProductionKwh ?? data.todayProductionKwh, 0),
        todayLoadKwh: numberOr(metrics?.todayLoadKwh ?? data.todayLoadKwh, 0),
        monthlyProductionKwh: numberOr(metrics?.monthlyProductionKwh ?? data.monthlyProductionKwh, 0),
        monthlyLoadKwh: numberOr(metrics?.monthlyLoadKwh ?? data.monthlyLoadKwh, 0),
      },
      flows: (data.flows as SolarOverview["flows"] | undefined) ?? mockOverview().flows,
    };
  } catch (error) {
    console.error(error);
    return { ...mockOverview(), status: "offline" };
  }
}

export async function getSolarHistory(): Promise<SolarHistory> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockHistory();

  try {
    return { ...(await deyeFetch<SolarHistory>(`/station/${config.stationId}/history`)), source: "live" };
  } catch (error) {
    console.error(error);
    return mockHistory();
  }
}

export async function getSolarAlarms(): Promise<SolarAlarms> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockAlarms();

  try {
    return { ...(await deyeFetch<SolarAlarms>(`/station/${config.stationId}/alarms`)), source: "live" };
  } catch (error) {
    console.error(error);
    return mockAlarms();
  }
}
