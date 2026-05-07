import { createHash } from "node:crypto";

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
  appId?: string;
  appSecret?: string;
  apiKey?: string;
  username?: string;
  email?: string;
  password?: string;
  companyId?: string;
  stationId?: string;
  deviceId?: string;
  loggerSn?: string;
};

type DeyeStationLatest = {
  success?: boolean;
  msg?: string;
  generationPower?: number;
  consumptionPower?: number;
  gridPower?: number;
  purchasePower?: number;
  wirePower?: number;
  chargePower?: number;
  dischargePower?: number;
  batteryPower?: number;
  batterySOC?: number;
  lastUpdateTime?: string;
};

type DeyeStationDataItem = {
  timeStamp?: string;
  year?: number;
  month?: number;
  day?: number;
  generationPower?: number;
  consumptionPower?: number;
  gridPower?: number;
  purchasePower?: number;
  wirePower?: number;
  chargePower?: number;
  dischargePower?: number;
  batteryPower?: number;
  batterySOC?: number;
  generationValue?: number;
  consumptionValue?: number;
};

type DeyeStationHistory = {
  success?: boolean;
  msg?: string;
  stationDataItems?: DeyeStationDataItem[];
};

type DeyeAlertItem = {
  alertCode?: string;
  alertEndTime?: number;
  alertId?: string;
  alertName?: string;
  alertStartTime?: number;
  description?: string;
  deviceSn?: string;
  deviceType?: string;
  impact?: number;
  level?: number;
  protocolName?: string;
  reason?: string;
  solution?: string;
  status?: number;
};

type DeyeStationAlerts = {
  success?: boolean;
  msg?: string;
  stationAlertItems?: DeyeAlertItem[];
  alertList?: DeyeAlertItem[];
};

type TokenResponse = {
  success?: boolean;
  msg?: string;
  accessToken?: string;
  tokenType?: string;
};

const numberOr = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nowIso = () => new Date().toISOString();

function getConfig(): DeyeConfig {
  return {
    baseUrl: process.env.DEYE_API_BASE_URL ?? "https://eu1-developer.deyecloud.com/v1.0",
    appId: process.env.DEYE_APP_ID,
    appSecret: process.env.DEYE_APP_SECRET,
    apiKey: process.env.DEYE_API_KEY,
    username: process.env.DEYE_USERNAME,
    email: process.env.DEYE_EMAIL,
    password: process.env.DEYE_PASSWORD,
    companyId: process.env.DEYE_COMPANY_ID ?? "0",
    stationId: process.env.DEYE_STATION_ID,
    deviceId: process.env.DEYE_DEVICE_ID,
    loggerSn: process.env.DEYE_LOGGER_SN,
  };
}

function hasLiveConfig(config: DeyeConfig) {
  return Boolean(
    config.baseUrl &&
      config.appId &&
      config.appSecret &&
      config.password &&
      config.stationId &&
      (config.email || config.username),
  );
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

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthString(date: Date) {
  return date.toISOString().slice(0, 7);
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeToken(token?: string, tokenType = "bearer") {
  if (!token) return "";
  if (/^bearer\s+/i.test(token)) return token;
  return `${tokenType} ${token}`;
}

async function getDeyeAccessToken(config: DeyeConfig) {
  if (config.apiKey) return normalizeToken(config.apiKey);
  if (!config.appId || !config.appSecret || !config.password) {
    throw new Error("Deye AppId, AppSecret, and password are required for live API.");
  }

  const url = new URL("/v1.0/account/token", config.baseUrl);
  url.searchParams.set("appId", config.appId);
  const identity = config.email ?? config.username;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appSecret: config.appSecret,
      companyId: Number(config.companyId ?? "0"),
      ...(identity?.includes("@") ? { email: identity } : { username: identity }),
      password: sha256(config.password),
    }),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Deye token request failed: ${response.status} ${response.statusText}`);
  }

  const token = (await response.json()) as TokenResponse;
  if (!token.success || !token.accessToken) {
    throw new Error(`Deye token request was rejected: ${token.msg ?? "unknown error"}`);
  }

  return normalizeToken(token.accessToken, token.tokenType);
}

async function deyePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getConfig();
  if (!hasLiveConfig(config)) {
    throw new Error("Deye API credentials are not configured.");
  }

  const url = new URL(path, config.baseUrl);
  const authorization = await getDeyeAccessToken(config);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Deye API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function ensureSuccess(response: { success?: boolean; msg?: string }, label: string) {
  if (response.success === false) {
    throw new Error(`${label} failed: ${response.msg ?? "unknown Deye API error"}`);
  }
}

function stationLatestToOverview(station: DeyeStationLatest, month?: DeyeStationHistory): SolarOverview {
  const solarKw = numberOr(station.generationPower, 0);
  const loadKw = numberOr(station.consumptionPower, 0);
  const chargeKw = numberOr(station.chargePower, 0);
  const dischargeKw = numberOr(station.dischargePower, 0);
  const batteryPowerKw = station.batteryPower !== undefined ? numberOr(station.batteryPower, chargeKw - dischargeKw) : chargeKw - dischargeKw;
  const gridPowerKw = station.gridPower !== undefined ? numberOr(station.gridPower, 0) : numberOr(station.purchasePower, 0) - numberOr(station.wirePower, 0);
  const today = month?.stationDataItems?.at(-1);
  const monthTotals = month?.stationDataItems ?? [];
  const monthlyProductionKwh = monthTotals.reduce((total, item) => total + numberOr(item.generationValue, 0), 0);
  const monthlyLoadKwh = monthTotals.reduce((total, item) => total + numberOr(item.consumptionValue, 0), 0);

  return {
    source: "live",
    status: "online",
    lastUpdated: station.lastUpdateTime ? new Date(station.lastUpdateTime).toISOString() : nowIso(),
    metrics: {
      solarKw,
      loadKw,
      batterySoc: numberOr(station.batterySOC, 0),
      batteryPowerKw,
      gridPowerKw,
      todayProductionKwh: numberOr(today?.generationValue, 0),
      todayLoadKwh: numberOr(today?.consumptionValue, 0),
      monthlyProductionKwh,
      monthlyLoadKwh,
    },
    flows: {
      solarToHomeKw: Math.min(solarKw, loadKw),
      solarToBatteryKw: Math.max(chargeKw, 0),
      solarToGridKw: Math.max(numberOr(station.wirePower, 0), 0),
      batteryToHomeKw: Math.max(dischargeKw, 0),
      gridToHomeKw: Math.max(numberOr(station.purchasePower, gridPowerKw), 0),
    },
  };
}

function historyToDashboard(daily: DeyeStationHistory, power: DeyeStationHistory): SolarHistory {
  const dailyProduction =
    daily.stationDataItems?.map((item, index) => ({
      day: item.day
        ? `${String(item.day).padStart(2, "0")}/${String(item.month ?? new Date().getMonth() + 1).padStart(2, "0")}`
        : `D${index + 1}`,
      kwh: numberOr(item.generationValue, 0),
    })) ?? [];

  const powerPoints =
    power.stationDataItems?.map((item) => ({
      time: item.timeStamp
        ? new Date(item.timeStamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : "",
      solarKw: numberOr(item.generationPower, 0),
      loadKw: numberOr(item.consumptionPower, 0),
      batterySoc: numberOr(item.batterySOC, 0),
    })) ?? [];

  return {
    source: "live",
    lastUpdated: nowIso(),
    dailyProduction,
    power: powerPoints,
  };
}

function alertLevel(level?: number): Alarm["level"] {
  if (level === 2) return "error";
  if (level === 1) return "warning";
  return "info";
}

function alertTime(timestamp?: number) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : nowIso();
}

function alertsToDashboard(response: DeyeStationAlerts): SolarAlarms {
  const items = response.stationAlertItems ?? response.alertList ?? [];
  return {
    source: "live",
    lastUpdated: nowIso(),
    alarms: items.map((item, index) => ({
      id: item.alertId ?? `${item.alertCode ?? "alert"}-${index}`,
      level: alertLevel(item.level),
      code: item.protocolName ?? item.alertCode ?? "DEYE_ALERT",
      message: item.alertName ?? item.description ?? item.reason ?? "Deye Cloud alert",
      device: item.deviceSn ?? item.deviceType ?? "Deye device",
      startedAt: alertTime(item.alertStartTime),
      resolvedAt: item.status === 0 ? alertTime(item.alertEndTime) : null,
    })),
  };
}

export async function getSolarOverview(): Promise<SolarOverview> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockOverview();

  try {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const [latest, month] = await Promise.all([
      deyePost<DeyeStationLatest>("/v1.0/station/latest", { stationId: Number(config.stationId) }),
      deyePost<DeyeStationHistory>("/v1.0/station/history", {
        stationId: Number(config.stationId),
        granularity: 2,
        startAt: dateString(monthStart),
        endAt: dateString(monthEnd),
      }),
    ]);
    ensureSuccess(latest, "Deye station latest");
    ensureSuccess(month, "Deye station history");
    return stationLatestToOverview(latest, month);
  } catch (error) {
    console.error(error);
    return { ...mockOverview(), status: "offline" };
  }
}

export async function getSolarHistory(): Promise<SolarHistory> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockHistory();

  try {
    const today = new Date();
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 13);
    const [daily, power] = await Promise.all([
      deyePost<DeyeStationHistory>("/v1.0/station/history", {
        stationId: Number(config.stationId),
        granularity: 2,
        startAt: dateString(fourteenDaysAgo),
        endAt: dateString(nextDay),
      }),
      deyePost<DeyeStationHistory>("/v1.0/station/history", {
        stationId: Number(config.stationId),
        granularity: 1,
        startAt: dateString(today),
      }),
    ]);
    ensureSuccess(daily, "Deye daily history");
    ensureSuccess(power, "Deye power history");
    return historyToDashboard(daily, power);
  } catch (error) {
    console.error(error);
    return mockHistory();
  }
}

export async function getSolarAlarms(): Promise<SolarAlarms> {
  const config = getConfig();
  if (!hasLiveConfig(config)) return mockAlarms();

  try {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    const alerts = await deyePost<DeyeStationAlerts>("/v1.0/station/alertList", {
      stationId: Number(config.stationId),
      startTimestamp: toUnixSeconds(start),
      endTimestamp: toUnixSeconds(end),
      page: 1,
      size: 20,
    });
    ensureSuccess(alerts, "Deye station alerts");
    return alertsToDashboard(alerts);
  } catch (error) {
    console.error(error);
    return mockAlarms();
  }
}
