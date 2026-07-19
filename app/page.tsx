"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  BatteryFull,
  CalendarDays,
  Camera,
  ChartSpline,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Square,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudOff,
  Cpu,
  Droplets,
  Info,
  Home,
  Maximize,
  Minimize,
  Moon,
  MoonStar,
  PlugZap,
  RefreshCw,
  Server,
  Sun,
  Thermometer,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import type { Alarm, EnergySummaryPeriod, SolarAlarms, SolarEnergySummary, SolarHistory, SolarOverview } from "@/lib/deye-api";
import type { WeatherForecast } from "@/lib/weather";

type DashboardData = {
  overview: SolarOverview;
  history: SolarHistory;
  alarms: SolarAlarms;
};

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

type ThemeMode = "light" | "dark";
type ActiveTab = "overview" | "devices" | "alerts" | "plant";
type EnergySummaryRange = "daily" | "weekly" | "monthly" | "yearly";
const onlineRefreshMs = 60_000;
const recoveryRefreshMs = 15_000;
const hiddenRefreshMs = 5 * 60_000;
const utilizationColors = ["#7c3aed", "#38bdf8", "#22c55e"];
const productionColors = ["#2563eb", "#f6b516", "#f472b6"];
const tabs: Array<{ id: ActiveTab; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: ChartSpline },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "plant", label: "Plant Info", icon: Info },
];
type DonutItem = { name: string; value: number };

function currentTemperature(weather: WeatherForecast | null) {
  return weather?.source === "live" ? Math.round(weather.current.temperatureC) : null;
}

function formatPower(value: number) {
  const abs = Math.abs(value);
  if (abs < 1) return `${(abs * 1000).toFixed(2)} W`;
  return `${abs.toFixed(2)} kW`;
}

function formatCompactPower(value: number) {
  const abs = Math.abs(value);
  if (abs < 1) return `${Math.round(abs * 1000)} W`;
  return `${abs.toFixed(2)} kW`;
}

function formatEnergyToday(value: number) {
  return value.toFixed(2);
}

function statusStyle(status: SolarOverview["status"]) {
  if (status === "error") return "status-badge status-badge-offline";
  if (status === "warning") return "status-badge status-badge-warning";
  if (status === "offline") return "status-badge status-badge-offline";
  return "status-badge status-badge-online";
}

function statusDotStyle(status: SolarOverview["status"]) {
  if (status === "error" || status === "offline") return "status-dot-offline";
  if (status === "warning") return "status-dot-warning";
  return "status-dot-online";
}

function sourceLabel(overview: DashboardData["overview"]) {
  if (overview.source !== "live") return "Mock data";
  if (overview.status === "offline") return "Last known Deye reading";
  if (overview.status === "warning") return "Delayed Deye Cloud API";
  return "Live Deye Cloud API";
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function donutPercent(item: DonutItem, items: DonutItem[]) {
  const total = items.reduce((sum, current) => sum + current.value, 0);
  return percent(item.value, total);
}

function DeyeOfflineNotice({ overview }: { overview: SolarOverview }) {
  if (overview.status !== "offline") return null;

  const lastUpdated = new Date(overview.lastUpdated).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="mb-3 flex gap-3 rounded-3xl border border-rose-300/45 bg-rose-500/16 px-4 py-3 text-rose-50 shadow-lg shadow-rose-950/10 backdrop-blur-2xl sm:mb-4 sm:items-center">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-rose-200/40 bg-rose-400/20 text-rose-100">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black">ระบบ Deye offline อยู่</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-50/82 sm:text-sm">
          ตัวเลขทั้งหมดที่แสดงเป็นค่าล่าสุดก่อนระบบล่ม อัปเดตล่าสุด {lastUpdated} เมื่อ Deye กลับมาออนไลน์ ระบบจะแสดงผล realtime อัตโนมัติ
        </p>
      </div>
    </section>
  );
}

function DonutPanel({
  title,
  value,
  data,
  colors,
  emptyLabel,
}: {
  title: string;
  value: string;
  data: DonutItem[];
  colors: string[];
  emptyLabel: string;
}) {
  const hasData = data.length > 0;
  const chartData = hasData ? data : [{ name: emptyLabel, value: 1 }];
  const chartColors = hasData ? colors : ["#dbeafe"];

  return (
    <div className="min-w-0">
      <div className="relative h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={hasData ? 2 : 0}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell fill={chartColors[index % chartColors.length]} key={entry.name} opacity={hasData ? 1 : 0.72} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <div className="max-w-28">
            <p className="truncate text-xs text-slate-500">{title}</p>
            <p className="data-readout text-sm font-semibold text-slate-950">{value}</p>
          </div>
        </div>
      </div>
      <div className="mt-2 grid min-h-[88px] content-start gap-2 text-sm">
        {hasData ? (
          data.map((item, index) => (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2" key={item.name}>
              <span className="flex min-w-0 items-center gap-2 text-slate-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} />
                <span className="truncate">{item.name}</span>
              </span>
              <strong className="shrink-0 text-slate-950">{donutPercent(item, data)}%</strong>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/35 px-3 py-2 text-slate-500">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" />
              <span className="truncate">{emptyLabel}</span>
            </span>
            <strong className="shrink-0 text-slate-700">0%</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  detail,
  icon: Icon,
  accent,
  featured = false,
}: {
  title: string;
  value: string;
  unit?: string;
  detail: string;
  icon: typeof Sun;
  accent: string;
  featured?: boolean;
}) {
  return (
    <section className={`glass premium-panel metric-card rounded-2xl p-5 ${featured ? `sm:col-span-2 lg:col-span-2 ${accent}` : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-2xl border border-white/45 p-2.5 shadow-lg ${featured ? "bg-white/22 text-white" : accent}`}>
          <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs ${featured ? "border-white/35 bg-white/20 text-white/76" : "border-indigo-100 bg-white/55 text-slate-500"}`}>
          {unit}
        </span>
      </div>
      <div className="mt-5">
        <p className={`text-sm font-medium uppercase tracking-[0.18em] ${featured ? "text-white/70" : "text-slate-500"}`}>{title}</p>
        <p className={`data-readout mt-2 font-semibold tracking-normal ${featured ? "text-5xl text-white" : "text-3xl text-slate-950"}`}>
          {value}
        </p>
        <div className={`mt-4 flex items-center gap-2 text-sm ${featured ? "text-white/72" : "text-slate-500"}`}>
          <span className="h-px w-8 bg-current opacity-35" />
          {detail}
        </div>
      </div>
    </section>
  );
}

function SkeletonDashboard() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="skeleton h-24 rounded-lg" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="skeleton h-40 rounded-lg" key={index} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="skeleton h-96 rounded-lg" />
        <div className="skeleton h-96 rounded-lg" />
      </div>
    </main>
  );
}

function HeroStats({ metrics, weather }: { metrics: SolarOverview["metrics"]; weather: WeatherForecast | null }) {
  const temperature = currentTemperature(weather);
  const WeatherIcon = weather?.source === "live" ? weatherIcon(weather.current.weatherCode, weather.current.isDay) : CloudSun;

  return (
    <div className="hero-stats grid grid-cols-2 gap-3 rounded-[1.35rem] border border-white/50 bg-white/22 p-3 backdrop-blur-xl sm:hidden">
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-slate-950">Production Today</p>
        <p className="data-readout mt-2 flex items-end gap-0.5 text-[2rem] font-black leading-none text-slate-950">
          {formatEnergyToday(metrics.todayProductionKwh)}
          <span className="mb-1 text-sm font-bold">kWh</span>
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-slate-950">Weather</p>
        <p className="data-readout mt-2 flex items-center gap-1 text-[2rem] font-black leading-none text-slate-950">
          {createElement(WeatherIcon, { className: "h-8 w-8 shrink-0 text-slate-950", strokeWidth: 2.2 })}
          {temperature ?? "--"}<span className="text-lg font-bold">°C</span>
        </p>
      </div>
    </div>
  );
}

function FlowNode({
  x,
  y,
  label,
  value,
  icon: Icon,
  tone,
  compact = false,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  icon: typeof Sun;
  tone: string;
  compact?: boolean;
}) {
  const width = compact ? 116 : 140;
  const height = compact ? 78 : 96;
  return (
    <foreignObject x={x - width / 2} y={y - height / 2} width={width} height={height}>
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/58 px-2 text-center shadow-2xl backdrop-blur">
        <div className={`rounded-full border border-indigo-100 bg-white/70 ${compact ? "p-1.5" : "p-2"}`}>
          <Icon className={`${compact ? "h-4 w-4" : "h-5 w-5"} ${tone}`} />
        </div>
        <span className={`${compact ? "mt-1 text-[9px] tracking-[0.12em]" : "mt-2 text-[11px] tracking-[0.14em]"} font-medium uppercase text-slate-500`}>{label}</span>
        <strong className={`data-readout text-slate-950 ${compact ? "text-xs" : "text-sm"}`}>{value}</strong>
      </div>
    </foreignObject>
  );
}

function FlowPath({
  d,
  value,
  color,
  delay = "0s",
}: {
  d: string;
  value: number;
  color: string;
  delay?: string;
}) {
  if (value <= 0.001) return null;
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      className="flow-line"
      style={{ animationDelay: delay, filter: `drop-shadow(0 0 6px ${color})` }}
    />
  );
}

function BaseFlowPath({ d }: { d: string }) {
  return (
    <path
      d={d}
      stroke="rgba(71, 85, 105, 0.42)"
      strokeWidth={2}
      strokeDasharray="8 10"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

function MobileFlowNode({
  className,
  label,
  value,
  icon: Icon,
  tone,
  status,
  batteryLevel,
  core = false,
}: {
  className: string;
  label: string;
  value: string;
  icon: typeof Sun;
  tone: string;
  status?: string;
  batteryLevel?: number;
  core?: boolean;
}) {
  return (
    <div className={`mobile-flow-node absolute z-10 flex w-[96px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${core ? "mobile-flow-node-core" : ""} ${className}`}>
      {status && <span className="mobile-node-status data-readout">{status}</span>}
      <div className={`${core ? "mobile-node-icon-core" : "mobile-node-icon"} relative flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border-[6px] border-slate-500/80 bg-slate-950/80 shadow-xl`}>
        {batteryLevel !== undefined ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="data-readout text-lg font-black leading-none text-blue-400">{batteryLevel}%</span>
            <BatteryFull className="h-7 w-7 text-white" />
          </div>
        ) : (
          <Icon className={`h-8 w-8 ${tone}`} strokeWidth={2.4} />
        )}
      </div>
      {value && <strong className="mobile-node-value data-readout mt-2 text-[22px] font-black leading-none text-white">{value}</strong>}
      {label && <span className="mobile-node-label mt-1 text-sm font-medium leading-none text-slate-400">{label}</span>}
    </div>
  );
}

function EnergyFlow({ overview, weather }: { overview: SolarOverview; weather: WeatherForecast | null }) {
  const { metrics, flows } = overview;
  const temperature = currentTemperature(weather);
  const WeatherIcon = weather?.source === "live" ? weatherIcon(weather.current.weatherCode, weather.current.isDay) : CloudSun;
  const solarToInverter = metrics.solarKw;
  const batteryToInverter = flows.batteryToHomeKw;
  const inverterToBattery = flows.solarToBatteryKw;
  const gridToInverter = metrics.gridPowerKw >= 0 ? Math.max(metrics.gridPowerKw, flows.gridToHomeKw, 0) : 0;
  const inverterToGrid = metrics.gridPowerKw < 0 ? Math.max(Math.abs(metrics.gridPowerKw), flows.solarToGridKw, 0) : 0;
  const inverterToUps = metrics.loadKw;
  const gridLabel = gridToInverter > 0.001 ? "Grid Import" : inverterToGrid > 0.001 ? "Grid Export" : "Grid";
  const gridValue = gridToInverter || inverterToGrid;
  const paths = {
    solarToInverter: "M 90 119 V 175 Q 90 195 110 195 H 280",
    batteryToInverter: "M 90 321 V 225 Q 90 205 110 205 H 280",
    inverterToBattery: "M 280 205 H 110 Q 90 205 90 225 V 321",
    gridToInverter: "M 610 119 V 175 Q 610 195 590 195 H 420",
    inverterToGrid: "M 420 195 H 590 Q 610 195 610 175 V 119",
    inverterToUps: "M 350 248 V 321",
    inverterToHome: "M 420 205 H 590 Q 610 205 610 225 V 321",
  };
  const mobilePaths = {
    solarToInverter: "M 104 116 H 130 Q 152 116 152 158 V 224 H 148",
    batteryToInverter: "M 78 338 V 290 Q 78 252 116 252 H 144",
    inverterToBattery: "M 144 266 H 116 Q 78 266 78 306 V 338",
    gridToInverter: "M 256 116 H 230 Q 208 116 208 158 V 224 H 212",
    inverterToGrid: "M 212 266 H 230 Q 256 266 256 226 V 116",
    inverterToUps: "M 180 266 V 340",
    inverterToLoad: "M 212 254 H 244 Q 270 254 270 300 V 338",
  };
  return (
    <section className="glass premium-panel rounded-3xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Live Distribution</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Energy Flow Matrix</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
              Vercel ใหม่
            </span>
            <span className="mt-1 max-w-[210px] truncate text-[11px] font-medium text-slate-400">
              account PondSuriya20 · not old project
            </span>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
            <Activity className="h-5 w-5 text-indigo-500" />
          </div>
        </div>
      </div>
      <div className="energy-flow-canvas mt-3 h-[500px] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/34 soft-grid lg:mt-4 lg:h-auto lg:aspect-[1.75/1] lg:min-h-[320px] xl:min-h-[420px]">
        <svg viewBox="0 0 700 400" className="hidden h-full w-full lg:block" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="flowGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="48%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          {solarToInverter <= 0.001 && <BaseFlowPath d={paths.solarToInverter} />}
          {batteryToInverter <= 0.001 && inverterToBattery <= 0.001 && <BaseFlowPath d={paths.batteryToInverter} />}
          {gridToInverter <= 0.001 && inverterToGrid <= 0.001 && <BaseFlowPath d={paths.gridToInverter} />}
          <BaseFlowPath d={paths.inverterToHome} />
          {inverterToUps <= 0.001 && <BaseFlowPath d={paths.inverterToUps} />}
          <FlowPath d={paths.solarToInverter} value={solarToInverter} color="#fbbf24" delay="0s" />
          <FlowPath d={paths.batteryToInverter} value={batteryToInverter} color="#fbbf24" delay="-0.45s" />
          <FlowPath d={paths.inverterToBattery} value={inverterToBattery} color="#10b981" delay="-0.45s" />
          <FlowPath d={paths.gridToInverter} value={gridToInverter} color="#38bdf8" delay="-0.9s" />
          <FlowPath d={paths.inverterToGrid} value={inverterToGrid} color="#38bdf8" delay="-0.9s" />
          <FlowPath d={paths.inverterToUps} value={inverterToUps} color="#a78bfa" delay="-1.25s" />
          <FlowNode compact x={90} y={80} label="Solar" value={formatPower(metrics.solarKw)} icon={Sun} tone="text-amber-400" />
          <FlowNode x={350} y={200} label="Inverter" value="Hybrid" icon={Cpu} tone="text-indigo-500" />
          <FlowNode compact x={350} y={360} label="UPS Load" value={formatPower(metrics.loadKw)} icon={Home} tone="text-violet-500" />
          <FlowNode
            compact
            x={90}
            y={360}
            label="Battery"
            value={`${metrics.batterySoc}% · ${formatPower(metrics.batteryPowerKw)}`}
            icon={BatteryFull}
            tone="text-cyan-500"
          />
          <FlowNode
            compact
            x={610}
            y={80}
            label={gridLabel}
            value={formatPower(gridValue)}
            icon={PlugZap}
            tone="text-blue-500"
          />
          <FlowNode compact x={610} y={360} label="Home Load" value="0 W" icon={Home} tone="text-emerald-500" />
        </svg>
        <div className="relative h-full w-full overflow-hidden lg:hidden">
          <svg viewBox="0 0 360 460" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            {solarToInverter <= 0.001 && <BaseFlowPath d={mobilePaths.solarToInverter} />}
            {batteryToInverter <= 0.001 && inverterToBattery <= 0.001 && <BaseFlowPath d={mobilePaths.batteryToInverter} />}
            {gridToInverter <= 0.001 && inverterToGrid <= 0.001 && <BaseFlowPath d={mobilePaths.gridToInverter} />}
            <BaseFlowPath d={mobilePaths.inverterToLoad} />
            {inverterToUps <= 0.001 && <BaseFlowPath d={mobilePaths.inverterToUps} />}
            <FlowPath d={mobilePaths.solarToInverter} value={solarToInverter} color="#fbbf24" delay="0s" />
            <FlowPath d={mobilePaths.batteryToInverter} value={batteryToInverter} color="#fbbf24" delay="-0.45s" />
            <FlowPath d={mobilePaths.inverterToBattery} value={inverterToBattery} color="#10b981" delay="-0.45s" />
            <FlowPath d={mobilePaths.gridToInverter} value={gridToInverter} color="#38bdf8" delay="-0.9s" />
            <FlowPath d={mobilePaths.inverterToGrid} value={inverterToGrid} color="#38bdf8" delay="-0.9s" />
            <FlowPath d={mobilePaths.inverterToUps} value={inverterToUps} color="#a78bfa" delay="-1.25s" />
          </svg>
          <MobileFlowNode className="left-[22%] top-[20%]" label="Production" value={formatCompactPower(metrics.solarKw)} icon={Sun} tone="text-white" />
          <MobileFlowNode core className="left-1/2 top-[51%]" label="" value="" icon={Cpu} tone="text-white" />
          <MobileFlowNode className="left-1/2 top-[84%]" label="Ups-Load" value={formatCompactPower(metrics.loadKw)} icon={Home} tone="text-white" />
          <MobileFlowNode
            batteryLevel={metrics.batterySoc}
            className="left-[22%] top-[84%]"
            label="Battery"
            value={formatCompactPower(metrics.batteryPowerKw)}
            icon={BatteryFull}
            tone="text-white"
          />
          <MobileFlowNode
            className="left-[78%] top-[20%]"
            label={gridLabel}
            status={gridToInverter > 0.001 ? "On grid" : undefined}
            value={formatCompactPower(gridValue)}
            icon={PlugZap}
            tone="text-white"
          />
          <MobileFlowNode className="left-[78%] top-[84%]" label="Load" value="0 W" icon={Home} tone="text-white" />
        </div>
      </div>
      <div className="mt-3 hidden grid-cols-2 gap-3 rounded-3xl border border-white/55 bg-white/45 p-3 backdrop-blur lg:grid 2xl:grid-cols-4">
        <div className="rounded-2xl bg-white/35 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] eyebrow-text">Monthly Production</p>
          <p className="data-readout mt-1 text-xl font-black text-slate-950">
            {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-xs">kWh</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/35 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] eyebrow-text">Monthly Load</p>
          <p className="data-readout mt-1 text-xl font-black text-slate-950">
            {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-xs">kWh</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/35 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] eyebrow-text">Daily Production</p>
          <p className="data-readout mt-1 text-xl font-black text-slate-950">
            {formatEnergyToday(metrics.todayProductionKwh)} <span className="text-xs">kWh</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white/35 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] eyebrow-text">Weather</p>
          <p className="data-readout mt-1 flex items-center gap-1 text-xl font-black text-slate-950">
            {createElement(WeatherIcon, { className: "h-4 w-4" })} {temperature ?? "--"} <span className="text-xs">°C</span>
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-3xl border border-white/55 bg-white/45 p-4 backdrop-blur lg:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500">Production</p>
            <p className="data-readout mt-1 text-xl font-black text-slate-950">
              {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-xs">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Consumption</p>
            <p className="data-readout mt-1 text-xl font-black text-slate-950">
              {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-xs">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Daily</p>
            <p className="data-readout mt-1 text-xl font-black text-slate-950">
              {formatEnergyToday(metrics.todayProductionKwh)} <span className="text-xs">kWh</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Weather</p>
            <p className="data-readout mt-1 flex items-center gap-1 text-xl font-black text-slate-950">
              {createElement(WeatherIcon, { className: "h-4 w-4" })} {temperature ?? "--"} <span className="text-xs">°C</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface CctvCardProps {
  title: string;
  subtitle?: string;
  baseUrl?: string;
  hasLensToggle?: boolean;
  hasPtz?: boolean;
  envName: string;
  cameraIp?: string;
  embedded?: boolean;
}

function CctvCard({
  title,
  subtitle,
  baseUrl,
  hasLensToggle = false,
  hasPtz = false,
  envName,
  cameraIp,
  embedded = false,
}: CctvCardProps) {
  const [lens, setLens] = useState<"lens_a" | "lens_b">("lens_a");
  const [restartCount, setRestartCount] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Prefer go2rtc's fragmented-MP4 endpoint over HLS: HLS module wedges
  // intermittently while the same producer keeps streaming bytes on
  // stream.mp4. <video src=…stream.mp4> plays the live fragmented MP4
  // natively in every modern browser, no hls.js, no WebSocket (Tailscale
  // Funnel terminates as HTTP/2 and drops WS upgrade — see the iframe
  // attempt in c949d03 / 509337a that broke for exactly that reason).
  //
  // We respect ?src= from the env so the operator can swap HD/SD without
  // a code change. Default to tapo_sd (avc1.64001F = H.264 L3.1) which
  // every browser decodes; the HD ladder advertises L4.1 but the camera
  // actually emits L5.0, which Chromium-family browsers reject.
  const hlsUrl = useMemo(() => {
    if (!baseUrl) return undefined;
    try {
      const u = new URL(baseUrl);
      u.pathname = u.pathname.replace(/stream\.m3u8$/, "stream.mp4");
      if (hasLensToggle) {
        const originalSrc = u.searchParams.get("src") || "tapo";
        const prefix = originalSrc.startsWith("tapo_2") ? "tapo_2" : "tapo";
        const targetSrc = lens === "lens_b" ? `${prefix}_lens_b_sd` : `${prefix}_sd`;
        u.searchParams.set("src", targetSrc);
      }
      return u.toString();
    } catch {
      return baseUrl;
    }
  }, [baseUrl, lens, hasLensToggle]);

  const restartStream = useCallback(async () => {
    if (!baseUrl || restarting) return;
    setRestarting(true);
    try {
      const origin = new URL(baseUrl).origin;
      await fetch(`${origin}/api/restart`, { method: "POST", mode: "no-cors" }).catch(() => {});
      // Give go2rtc a moment to reconnect to RTSP before reloading the player.
      await new Promise((resolve) => setTimeout(resolve, 7000));
      setRestartCount((n) => n + 1);
    } finally {
      setRestarting(false);
    }
  }, [baseUrl, restarting]);

  const streamLabel = hasLensToggle ? (lens === "lens_b" ? "Lens B · PTZ" : "Lens A · Fixed") : "Live";
  const lensDescription = hasLensToggle ? (lens === "lens_b" ? "Lens B · Wide & PTZ" : "Lens A · Close-up & Fixed") : "Single Lens Feed";

  return (
    <section className={embedded ? "flex flex-col" : "glass premium-panel flex flex-col rounded-3xl p-5"}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Security Feed</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {subtitle ? `${subtitle} · ` : ""}
            {lensDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {baseUrl && hasLensToggle && (
            <div className="flex overflow-hidden rounded-xl border border-indigo-100 bg-white/55 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setLens("lens_a")}
                className={`px-3 py-1.5 transition ${lens === "lens_a" ? "bg-indigo-500 text-white" : "text-slate-600 hover:bg-white/80"}`}
              >
                Lens A (Fixed)
              </button>
              <button
                type="button"
                onClick={() => setLens("lens_b")}
                className={`px-3 py-1.5 transition ${lens === "lens_b" ? "bg-indigo-500 text-white" : "text-slate-600 hover:bg-white/80"}`}
              >
                Lens B (PTZ)
              </button>
            </div>
          )}
          {hlsUrl && (
            <button
              aria-label={isMuted ? "เปิดเสียงกล้อง" : "ปิดเสียงกล้อง"}
              onClick={() => setIsMuted((muted) => !muted)}
              type="button"
              className="rounded-2xl border border-indigo-100 bg-white/55 p-2 text-indigo-500 transition"
              title={isMuted ? "เปิดเสียงกล้อง" : "ปิดเสียงกล้อง"}
            >
              {isMuted ? <VolumeX className="h-5 w-5 text-indigo-500" /> : <Volume2 className="h-5 w-5 text-emerald-500" />}
            </button>
          )}
          {hlsUrl && (
            <button
              aria-label="Restart stream"
              onClick={restartStream}
              disabled={restarting}
              type="button"
              className="rounded-2xl border border-indigo-100 bg-white/55 p-2 text-indigo-500 transition disabled:cursor-wait disabled:opacity-50"
              title="Restart stream (kicks go2rtc)"
            >
              <RefreshCw className={`h-5 w-5 ${restarting ? "animate-spin" : ""}`} />
            </button>
          )}
          <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
            <Camera className="h-5 w-5 text-indigo-500" />
          </div>
        </div>
      </div>
      <div
        className="group relative mt-4 flex aspect-video w-full flex-col overflow-hidden rounded-3xl border border-white/55 bg-slate-950/75 shadow-2xl"
        onDoubleClick={() => hlsUrl && setIsExpanded(true)}
      >
        {hlsUrl ? (
          <CctvLivePlayer
            key={`${restartCount}-${lens}`}
            src={hlsUrl}
            isMuted={isMuted}
            onMuteChange={setIsMuted}
            label={streamLabel}
          />
        ) : (
          <CctvPlaceholder
            title="Camera not configured"
            detail={`Set ${envName} in env. See docs/CCTV_SETUP.md`}
          />
        )}
        {hlsUrl && (
          <button
            type="button"
            aria-label={`ขยาย ${title} เต็มจอ`}
            onClick={() => setIsExpanded(true)}
            className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur transition hover:border-cyan-300/45 hover:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
            title="ขยายเต็มจอ"
          >
            <Maximize className="h-4 w-4" />
            ขยาย
          </button>
        )}
      </div>
      {hlsUrl && hasPtz && lens === "lens_b" && <CctvPtzControls cameraIp={cameraIp} />}
      {hlsUrl && (
        <CctvFullscreenModal
          key={`modal-${restartCount}-${lens}`}
          open={isExpanded}
          onClose={() => setIsExpanded(false)}
          title={title}
          subtitle={subtitle ? `${subtitle} · ${lensDescription}` : lensDescription}
          src={hlsUrl}
          streamLabel={streamLabel}
          isMuted={isMuted}
          onMuteChange={setIsMuted}
          showPtz={hasPtz && lens === "lens_b"}
          cameraIp={cameraIp}
        />
      )}
    </section>
  );
}

function CctvFullscreenModal({
  open,
  onClose,
  title,
  subtitle,
  src,
  streamLabel,
  isMuted,
  onMuteChange,
  showPtz,
  cameraIp,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  src: string;
  streamLabel: string;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  showPtz: boolean;
  cameraIp?: string;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] h-screen w-screen overflow-auto bg-slate-950/95 p-2 text-white backdrop-blur-xl sm:p-4 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} fullscreen camera view`}
    >
      <div className="mx-auto flex h-full min-h-full w-full max-w-[1900px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">Expanded Camera</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-2xl">{title}</h2>
            <p className="mt-1 truncate text-xs text-white/55">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white/80 transition hover:bg-white/14 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
            aria-label="ปิดภาพเต็มจอ"
            title="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-950">
          <CctvLivePlayer
            src={src}
            isMuted={isMuted}
            onMuteChange={onMuteChange}
            label={streamLabel}
            fullscreen
          />
        </div>
        {showPtz && <CctvPtzControls cameraIp={cameraIp} />}
      </div>
    </div>,
    document.body,
  );
}

function CctvPtzControls({ cameraIp }: { cameraIp?: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (direction: string, duration_ms = 400) => {
    setPending(direction);
    setError(null);
    try {
      const res = await fetch("/api/cctv/ptz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, duration_ms, ip: cameraIp }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "PTZ command failed");
    } finally {
      setPending(null);
    }
  }, [cameraIp]);

  const btn = (label: string, dir: string, Icon: typeof ChevronUp, classes = "") =>
    createElement(
      "button",
      {
        type: "button",
        "aria-label": label,
        disabled: pending !== null,
        onClick: () => send(dir),
        className: `flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/82 transition hover:bg-white/12 hover:text-white disabled:opacity-40 ${classes}`,
      },
      createElement(Icon, { className: "h-5 w-5" }),
    );

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] eyebrow-text-inset">Pan / Tilt</p>
        <p className="mt-0.5 text-[11px] text-white/55">
          {error ? <span className="text-rose-300">{error}</span> : pending ? `Moving ${pending}…` : "ควบคุมการหมุนเลนส์ตรงนี้ได้เลย"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span />
        {btn("ขยับขึ้น", "up", ChevronUp)}
        <span />
        {btn("ซ้าย", "left", ChevronLeft)}
        {btn("หยุด", "stop", Square, "text-rose-300")}
        {btn("ขวา", "right", ChevronRight)}
        <span />
        {btn("ขยับลง", "down", ChevronDown)}
        <span />
      </div>
    </div>
  );
}

function CctvPlaceholder({ title = "Tapo camera slot ready", detail }: { title?: string; detail?: string }) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/62">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          Awaiting Tapo stream
        </span>
        <span>RTSP / LAN</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.22),transparent_28rem),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,91,0.86))]">
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-cyan-200 shadow-2xl">
            <Camera className="h-9 w-9" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">{title}</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/55">
            {detail ?? (
              <>
                Set <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-cyan-200">NEXT_PUBLIC_CCTV_HLS_URL</code> in env. See <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-cyan-200">docs/CCTV_SETUP.md</code>.
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

function CctvLivePlayer({
  src,
  label: streamLabel = "Live",
  isMuted,
  onMuteChange,
  fullscreen = false,
}: {
  src: string;
  label?: string;
  isMuted: boolean;
  onMuteChange: (muted: boolean) => void;
  fullscreen?: boolean;
}) {
  // Play the live fragmented MP4 directly. The iframe-into-stream.html
  // approach (commit 509337a) needs go2rtc's <video-stream> web
  // component, which opens a WebSocket to /api/ws as its signal
  // channel. Tailscale Funnel terminates as HTTP/2 and refuses the
  // HTTP/1.1 WS upgrade with a 400, so iframe playback wedges to a
  // broken-image icon while the status badge stays "Live".
  //
  // Native <video src=stream.mp4> works because go2rtc emits an
  // infinite fragmented-MP4 over a single long-lived HTTP/2 GET, which
  // browsers handle without any negotiation channel.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [cacheBuster, setCacheBuster] = useState(0);
  const streamStartTimeRef = useRef<number | null>(null);

  // Derive streamUrl with the cache buster query parameter
  const streamUrl = useMemo(() => {
    if (!src) return "";
    try {
      const url = new URL(src);
      url.searchParams.set("_cb", cacheBuster.toString());
      return url.toString();
    } catch {
      return src;
    }
  }, [src, cacheBuster]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("loading");
    const onPlaying = () => {
      setStatus("live");
      if (streamStartTimeRef.current === null) {
        streamStartTimeRef.current = Date.now() / 1000 - video.currentTime;
      }
    };
    const onWaiting = () => setStatus("loading");
    const onStalled = () => setStatus("loading");
    const onError = () => setStatus("error");

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);

    video.src = streamUrl;
    video.play().catch(() => {
      // Autoplay blocked → keep controls visible so user can tap.
    });

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
      // Detach the long-lived stream so go2rtc can drop the consumer.
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.defaultMuted = isMuted;
    if (!isMuted) {
      video.volume = 1;
      video.play().catch(() => {});
    }
  }, [isMuted]);

  // Auto-recovery when stream is stuck in loading or error state
  useEffect(() => {
    if (status === "live") return;

    const timer = setTimeout(() => {
      console.log(`Stream stalled/error (status=${status}) for 8 seconds, auto-reconnecting...`);
      streamStartTimeRef.current = null;
      setCacheBuster(Date.now());
    }, 8000);

    return () => clearTimeout(timer);
  }, [status]);

  // Periodic drift check to keep the video feed strictly real-time
  useEffect(() => {
    if (status !== "live") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || streamStartTimeRef.current === null) return;

      const elapsedWallClock = Date.now() / 1000 - streamStartTimeRef.current;
      const drift = elapsedWallClock - video.currentTime;

      if (drift > 3.5) {
        console.log(`CCTV stream drift detected: ${drift.toFixed(2)}s. Reloading to catch up...`);
        streamStartTimeRef.current = null;
        setCacheBuster(Date.now());
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  // Monitor visibility and focus to reload if backgrounded or lagged behind
  useEffect(() => {
    const checkDriftAndReload = () => {
      const video = videoRef.current;
      if (!video || status === "loading") return;

      let shouldReload = false;
      if (status === "error" || streamStartTimeRef.current === null) {
        shouldReload = true;
      } else {
        const elapsedWallClock = Date.now() / 1000 - streamStartTimeRef.current;
        const drift = elapsedWallClock - video.currentTime;
        if (drift > 3.0) {
          shouldReload = true;
        }
      }

      if (shouldReload) {
        console.log("CCTV stream reload triggered (tab focused or visibility changed to sync with real-time)...");
        streamStartTimeRef.current = null;
        setCacheBuster(Date.now());
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDriftAndReload();
      }
    };

    const handleFocus = () => {
      checkDriftAndReload();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [streamUrl, status]);

  const dot =
    status === "live" ? "bg-emerald-400 animate-pulse" :
    status === "error" ? "bg-rose-400" : "bg-amber-300";
  const label = status === "live" ? streamLabel : status === "error" ? "Stream offline" : "Connecting…";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/62">
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </span>
        <span>fMP4</span>
      </div>
      <div className={`relative flex min-h-0 flex-1 items-center justify-center bg-slate-950 ${fullscreen ? "overflow-hidden px-2 py-2 sm:px-8 sm:py-6 lg:px-12" : ""}`}>
        <video
          ref={videoRef}
          autoPlay
          muted={isMuted}
          playsInline
          controls
          onVolumeChange={() => {
            const video = videoRef.current;
            if (video) onMuteChange(video.muted);
          }}
          className={fullscreen ? "h-auto w-auto max-h-full max-w-full object-contain" : "h-full w-full bg-black object-contain"}
        />
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 px-4 text-center">
            <Camera className="h-9 w-9 text-rose-300" />
            <p className="mt-3 text-sm font-semibold text-white">Stream offline</p>
            <p className="mt-2 max-w-xs text-[11px] text-white/45">เช็ค go2rtc + Tailscale Funnel ที่บ้าน — รัน <code>cctv-health.sh</code></p>
          </div>
        )}
      </div>
    </div>
  );
}

function weatherIcon(code: number, isDay = true) {
  if (code === 0) return isDay ? Sun : MoonStar;
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return isDay ? CloudSun : CloudMoon;
}

function weatherTone(code: number, isDay = true) {
  if (code === 0 || code === 1) return isDay ? "text-amber-400" : "text-indigo-300";
  if (code === 2 || code === 3) return isDay ? "text-slate-400" : "text-indigo-300";
  if (code >= 45 && code <= 48) return "text-slate-400";
  if (code >= 51 && code <= 67) return "text-sky-400";
  if (code >= 80 && code <= 82) return "text-sky-500";
  if (code >= 95) return "text-violet-500";
  return isDay ? "text-amber-400" : "text-indigo-300";
}

function ServerStatusStrip() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/server-status", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { updatedAt?: string; servers?: ServerStatus[] }) => {
          if (cancelled) return;
          setServers(data.servers ?? []);
          setUpdatedAt(data.updatedAt ?? null);
        })
        .catch(() => {
          if (!cancelled) setServers([]);
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (servers.length === 0) return null;

  return (
    <section className="server-status-strip glass premium-panel rounded-3xl px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-2xl border border-white/45 bg-white/30 p-2 text-cyan-300">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] eyebrow-text">System thermal status</p>
            {updatedAt && <p className="mt-0.5 text-[11px] text-slate-500">Updated {new Date(updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>}
          </div>
        </div>
        <div className="grid flex-1 gap-2 md:grid-cols-2">
          {servers.map((server) => (
            <ServerStatusPill key={server.id} server={server} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServerStatusPill({ server }: { server: ServerStatus }) {
  const tone =
    server.status === "offline"
      ? "border-rose-300/35 bg-rose-500/10 text-rose-200"
      : server.status === "warning"
        ? "border-amber-300/35 bg-amber-400/10 text-amber-100"
        : "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  const dot =
    server.status === "offline"
      ? "bg-rose-400"
      : server.status === "warning"
        ? "bg-amber-300"
        : "bg-emerald-400";

  return (
    <div className={`server-status-pill flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${tone}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0">
          <p className="server-status-title truncate text-sm font-bold">{server.name}</p>
          <p className="server-status-detail truncate text-[11px]">{server.role} · {server.detail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-right">
        {server.fanRpm !== null && <span className="server-status-detail hidden text-[11px] sm:inline">{server.fanRpm} RPM</span>}
        <div>
          <p className="server-status-temp data-readout flex items-center justify-end gap-1 text-xl font-black">
            <Thermometer className="h-4 w-4" />
            {server.temperatureC !== null ? `${Math.round(server.temperatureC)}°` : "--°"}
          </p>
          <p className="server-status-detail text-[10px] uppercase tracking-wide">{server.maxSensor ?? server.status}</p>
        </div>
      </div>
    </div>
  );
}

function WeatherForecastCard({ forecast }: { forecast: WeatherForecast | null }) {
  if (!forecast || forecast.hourly.length === 0) return null;

  const currentTone = weatherTone(forecast.current.weatherCode, forecast.current.isDay);

  return (
    <section className="glass premium-panel rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Forecast</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">12-hour outlook</h2>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/55 bg-white/45 px-3 py-2">
          {createElement(weatherIcon(forecast.current.weatherCode, forecast.current.isDay), {
            className: `h-6 w-6 ${currentTone}`,
            strokeWidth: 2.2,
          })}
          <span className="data-readout text-xl font-black text-slate-950">{Math.round(forecast.current.temperatureC)}°</span>
        </div>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:gap-2.5 lg:mx-0 lg:overflow-visible lg:px-0">
        {forecast.hourly.map((hour) => {
          const tone = weatherTone(hour.weatherCode, hour.isDay);
          const date = new Date(hour.time);
          const hourLabel = date.toLocaleTimeString("th-TH", { hour: "2-digit", hour12: false });
          return (
            <div
              key={hour.time}
              className="flex min-w-[64px] flex-col items-center gap-1 rounded-2xl border border-white/70 bg-white/5 px-2.5 py-3 sm:min-w-[72px] lg:min-w-0 lg:flex-1"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{hourLabel}</span>
              {createElement(weatherIcon(hour.weatherCode, hour.isDay), {
                className: `h-6 w-6 ${tone}`,
                strokeWidth: 2.2,
              })}
              <span className="data-readout text-lg font-black leading-none text-slate-950">
                {Math.round(hour.temperatureC)}°
              </span>
              {hour.precipProbability > 5 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sky-600">
                  <Droplets className="h-3 w-3" />
                  {hour.precipProbability}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChartPanel({
  title,
  eyebrow,
  children,
}: Readonly<{
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="glass premium-panel rounded-3xl p-5">
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">{eyebrow}</p>}
      <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function AlarmCard({ alarm }: { alarm: Alarm }) {
  const tone =
    alarm.level === "error"
      ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
      : alarm.level === "warning"
        ? "border-amber-300/35 bg-amber-400/10 text-amber-100"
        : "border-sky-300/30 bg-sky-400/10 text-sky-100";

  return (
    <article className={`rounded-lg border p-4 transition hover:-translate-y-0.5 ${tone}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm">{alarm.code}</strong>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/65">{alarm.device}</span>
          </div>
          <p className="mt-2 text-sm text-white/72">{alarm.message}</p>
          <p className="mt-3 text-xs text-white/45">
            {new Date(alarm.startedAt).toLocaleString()} {alarm.resolvedAt ? "resolved" : "active"}
          </p>
        </div>
      </div>
    </article>
  );
}

function formatSummaryKwh(value: number | null) {
  if (value === null) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
  return `${value.toFixed(1)} kWh`;
}

function EnergySummaryHero({ title, period }: { title: string; period: EnergySummaryPeriod | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/[0.09] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_30px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
      <div aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/55" />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.85)]" />Generated</p>
          <p className="data-readout mt-1 text-xl font-black text-slate-950">{formatSummaryKwh(period?.productionKwh ?? null)}</p>
        </div>
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-100"><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.85)]" />Consumed</p>
          <p className="data-readout mt-1 text-xl font-black text-slate-950">{formatSummaryKwh(period?.consumptionKwh ?? null)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>Energy in kWh</span>
        <span>{period ? `${period.days} days covered` : "No data"}</span>
      </div>
    </div>
  );
}

function EnergySummaryList({ title, subtitle, periods }: { title: string; subtitle: string; periods: EnergySummaryPeriod[] }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <Zap className="h-4 w-4 shrink-0 text-amber-500" />
      </div>
      <div className="mt-3 space-y-2">
        {periods.length > 0 ? (
          periods.map((period) => (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2.5 transition-colors hover:bg-white/[0.14]" key={period.period}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{period.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Consumed {formatSummaryKwh(period.consumptionKwh)}</p>
              </div>
              <strong className="data-readout shrink-0 text-sm font-bold text-cyan-100 drop-shadow-[0_0_10px_rgba(103,232,249,0.35)]">{formatSummaryKwh(period.productionKwh)}</strong>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-4 text-center text-sm text-slate-500">No data available for this range</div>
        )}
      </div>
    </div>
  );
}

function EnergyHistorySection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [summary, setSummary] = useState<SolarEnergySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<EnergySummaryRange>("daily");

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    let cancelled = false;
    let requested = false;
    const loadSummary = async () => {
      if (requested) return;
      requested = true;
      setIsLoading(true);
      try {
        const response = await fetch("/api/solar/summary", { cache: "no-store" });
        const next = (await response.json()) as SolarEnergySummary & { error?: string };
        if (!response.ok) throw new Error(next.error ?? "Unable to load energy history.");
        if (!cancelled) {
          setSummary(next);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load energy history.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (!("IntersectionObserver" in window)) {
      void loadSummary();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadSummary();
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const rangeConfig: Record<EnergySummaryRange, { label: string; subtitle: string; limit: number }> = {
    daily: { label: "Daily", subtitle: "Last 14 days", limit: 14 },
    weekly: { label: "Weekly", subtitle: "Last 8 weeks", limit: 8 },
    monthly: { label: "Monthly", subtitle: "Months with data this year", limit: 12 },
    yearly: { label: "Yearly", subtitle: "Years available from Deye", limit: 5 },
  };
  const selectedPeriods = summary?.[range] ?? [];
  const selectedConfig = rangeConfig[range];
  const chartPeriods = selectedPeriods.slice(-selectedConfig.limit);
  const detailPeriods = [...chartPeriods].reverse();

  return (
    <section className="relative mt-4 scroll-mt-4 overflow-hidden rounded-3xl border border-white/25 bg-white/[0.07] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-2xl" id="energy-history-section" ref={sectionRef}>
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/55" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Energy history</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Energy Summary</h2>
          <p className="mt-1 text-sm text-slate-500">Generation and consumption across every time range</p>
        </div>
        <div className="rounded-2xl border border-white/25 bg-white/[0.09] p-2 text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl">
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>

      {isLoading && (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div className="skeleton h-28 rounded-2xl" key={index} />)}
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-5 rounded-2xl border border-rose-200/50 bg-rose-400/10 p-4 text-sm text-rose-700 backdrop-blur-xl">
          History request failed: {error}
        </div>
      )}

      {summary && !isLoading && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EnergySummaryHero title="Today" period={summary.current.today} />
            <EnergySummaryHero title="This week" period={summary.current.week} />
            <EnergySummaryHero title="This month" period={summary.current.month} />
            <EnergySummaryHero title="This year" period={summary.current.year} />
          </div>

          {summary.error && (
            <div className="mt-4 rounded-2xl border border-amber-200/45 bg-amber-400/10 p-3 text-sm text-amber-800 backdrop-blur-xl">
              History request failed: {summary.error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
            <div>
              <p className="text-sm font-semibold text-slate-950">Explore by time range</p>
              <p className="mt-0.5 text-xs text-slate-500">The chart compares generated and consumed energy</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="sr-only">Choose energy range</span>
              <select
                aria-label="Choose energy range"
                className="rounded-xl border border-indigo-200 bg-white/75 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                onChange={(event) => setRange(event.target.value as EnergySummaryRange)}
                value={range}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-white/20 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">Generation vs. consumption · {selectedConfig.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{selectedConfig.subtitle}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 text-cyan-100"><span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]" />Generated</span>
                  <span className="inline-flex items-center gap-1.5 text-amber-100"><span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]" />Consumed</span>
                </div>
              </div>
              <div className="mt-3 h-72">
                {chartPeriods.length > 0 ? (
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={chartPeriods} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(99,102,241,0.12)" vertical={false} />
                      <XAxis dataKey="label" interval="preserveStartEnd" stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "rgba(255,255,255,.94)", border: "1px solid rgba(129,140,248,.22)", borderRadius: 16, color: "#1e293b" }} />
                      <Bar dataKey="productionKwh" name="Generated (kWh)" fill="#67e8f9" radius={[7, 7, 0, 0]} />
                      <Bar dataKey="consumptionKwh" name="Consumed (kWh)" fill="#fcd34d" radius={[7, 7, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-sm text-slate-500">No data available for this range</div>
                )}
              </div>
            </div>

            <EnergySummaryList title={`${selectedConfig.label} details`} subtitle="Newest first" periods={detailPeriods} />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Source: {summary.source === "live" ? "Deye Cloud history" : "Mock data"}
            {summary.coverageStart && summary.coverageEnd ? ` · Coverage: ${summary.coverageStart} to ${summary.coverageEnd}` : " · No usable history range"}
          </p>
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = window.localStorage.getItem("deye-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const pullActive = useRef(false);
  const overviewStatusRef = useRef<SolarOverview["status"] | null>(null);
  const PULL_THRESHOLD = 70;

  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      setError(null);
      const url = `/api/solar/dashboard?refresh=${Date.now()}`;
      const dashboard = await fetch(url, { cache: "no-store" }).then((response) => response.json());
      if (dashboard.error) {
        throw new Error(dashboard.error);
      }
      const { overview, history, alarms, weather: forecast } = dashboard;

      if (overview.error || history.error || alarms.error) {
        throw new Error(overview.error ?? history.error ?? alarms.error);
      }

      setData({ overview, history, alarms });
      overviewStatusRef.current = overview.status;
      if (forecast && !forecast.error) setWeather(forecast as WeatherForecast);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load solar data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("deye-theme", theme);
  }, [theme]);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    const nextDelay = () => {
      if (document.visibilityState !== "visible") return hiddenRefreshMs;
      const status = overviewStatusRef.current;
      return status === "warning" || status === "offline" || status === "error" ? recoveryRefreshMs : onlineRefreshMs;
    };

    const run = async () => {
      await loadData();
      if (!stopped) timer = window.setTimeout(run, nextDelay());
    };

    timer = window.setTimeout(run, 0);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [loadData]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) {
        pullActive.current = false;
        return;
      }
      pullStartY.current = event.touches[0].clientY;
      pullActive.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pullActive.current) return;
      const dy = event.touches[0].clientY - pullStartY.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullActive.current = false;
        setPullDistance(0);
        return;
      }
      const damped = Math.min(dy * 0.45, 110);
      setPullDistance(damped);
    };

    const onTouchEnd = () => {
      if (!pullActive.current) return;
      pullActive.current = false;
      if (pullDistance >= PULL_THRESHOLD) {
        window.location.reload();
        return;
      }
      setPullDistance(0);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pullDistance, loadData]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadData(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadData]);

  const metrics = data?.overview.metrics;
  const flows = data?.overview.flows;
  const batteryMode = useMemo(() => {
    if (!metrics) return "";
    if (metrics.batteryPowerKw > 0.05) return `Discharging ${formatPower(metrics.batteryPowerKw)}`;
    if (metrics.batteryPowerKw < -0.05) return `Charging ${formatPower(metrics.batteryPowerKw)}`;
    return "Idle";
  }, [metrics]);
  const utilizationData = useMemo(() => {
    if (!flows) return [];
    return [
      { name: "Grid", value: flows.gridToHomeKw },
      { name: "Battery", value: flows.batteryToHomeKw },
      { name: "PV", value: flows.solarToHomeKw },
    ].filter((item) => item.value > 0);
  }, [flows]);
  const productionMixData = useMemo(() => {
    if (!flows) return [];
    return [
      { name: "UPS Load", value: flows.solarToHomeKw },
      { name: "Battery Charge", value: flows.solarToBatteryKw },
      { name: "Grid Export", value: flows.solarToGridKw },
    ].filter((item) => item.value > 0);
  }, [flows]);
  const selectTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    const targetId =
      tab === "overview"
        ? "dashboard-top"
        : tab === "devices"
          ? "devices-section"
          : tab === "alerts"
            ? "alerts-section"
            : "plant-section";
    window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, []);

  if (isLoading) return <SkeletonDashboard />;
  if (!data || !metrics) return null;

  return (
    <div className={`${theme === "dark" ? "dark-dashboard" : "light-dashboard"} min-h-screen px-3 pb-24 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5 sm:pb-4 sm:pt-3 lg:px-6`}>
      {pullDistance > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center sm:hidden"
          style={{
            transform: `translateY(${Math.max(pullDistance - 50, 0)}px)`,
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
          }}
        >
          <div className="mt-2 rounded-full border border-white/40 bg-slate-950/85 px-3 py-2 shadow-lg backdrop-blur-md">
            <RefreshCw
              className={`h-5 w-5 text-cyan-300 ${pullDistance >= PULL_THRESHOLD ? "rotate-180" : ""} ${isRefreshing ? "animate-spin" : ""} transition-transform duration-200`}
            />
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[1860px]" id="dashboard-top">
        <header className="mb-3 flex flex-col gap-2 rounded-[1.4rem] border border-white/60 bg-white/38 px-3 py-2.5 shadow-xl shadow-indigo-500/10 backdrop-blur-2xl sm:mb-4 sm:flex-row sm:items-center sm:gap-3 sm:rounded-3xl sm:px-4 sm:py-3 sm:justify-between">
          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3 sm:flex-wrap lg:flex-nowrap lg:gap-4">
            <div className="flex items-center gap-2 sm:shrink-0">
              <h1 className="text-2xl font-semibold leading-none text-slate-950 sm:text-xl">725</h1>
              <button
                aria-label="Refresh data"
                className="rounded-full bg-white/60 p-2 text-slate-600 shadow-sm"
                onClick={() => {
                  void loadData(true);
                }}
                type="button"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="ml-auto inline-flex items-center justify-center rounded-full bg-white/42 p-2 text-slate-600 sm:hidden"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                type="button"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <span className="hidden rounded-full bg-white/50 px-3 py-1 text-sm text-slate-500 sm:inline-flex">10kWp</span>
            </div>
            <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:mt-0 sm:flex sm:flex-wrap sm:gap-3 sm:text-sm lg:min-w-0 lg:flex-nowrap">
              <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 ${statusStyle(data.overview.status)}`}>
                <span className={`pulse-dot h-2 w-2 rounded-full ${statusDotStyle(data.overview.status)}`} />
                {data.overview.status}
              </span>
              <span className="min-w-0 truncate">Inverter 1 · {sourceLabel(data.overview)}</span>
              <span className="col-span-2 truncate sm:col-span-1 lg:min-w-0">Last update {new Date(data.overview.lastUpdated).toLocaleString()}</span>
            </div>
            <div className="mt-3 sm:hidden">
              <HeroStats metrics={metrics} weather={weather} />
            </div>
          </div>
          <nav className="hidden shrink-0 gap-2 overflow-x-auto text-sm font-medium text-slate-600 sm:flex lg:flex">
            <button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white/42 px-3 py-2 text-slate-600"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white/42 px-3 py-2 text-slate-600"
              onClick={toggleFullscreen}
              type="button"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            {tabs.map((tab) => (
              <button
                className={`hidden shrink-0 rounded-2xl px-4 py-2 sm:inline-flex ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-500 to-fuchsia-400 text-white shadow-lg shadow-indigo-500/20" : "bg-white/42"}`}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <DeyeOfflineNotice overview={data.overview} />

        {error && (
          <section className="mb-4 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-rose-700 backdrop-blur">
            <div className="flex items-center gap-2">
              <CloudOff className="h-5 w-5" />
              <strong>Data connection issue</strong>
            </div>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <EnergyFlow overview={data.overview} weather={weather} />
          </div>
          <div className="glass premium-panel flex flex-col rounded-3xl p-5 lg:max-h-[calc(100vh-10rem)]">
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-6">
              {process.env.NEXT_PUBLIC_CCTV_HLS_URL_3 && (
                <>
                  <div className="shrink-0">
                    <CctvCard
                      title="Solar Camera 1"
                      subtitle="Tapo C545d"
                      baseUrl={process.env.NEXT_PUBLIC_CCTV_HLS_URL_3}
                      hasLensToggle={true}
                      hasPtz={true}
                      envName="NEXT_PUBLIC_CCTV_HLS_URL_3"
                      cameraIp={process.env.NEXT_PUBLIC_CCTV_CAMERA_IP_3}
                      embedded={true}
                    />
                  </div>
                  <hr className="border-white/10 shrink-0" />
                </>
              )}
              <div className="shrink-0">
                <CctvCard
                  title={process.env.NEXT_PUBLIC_CCTV_HLS_URL_3 ? "Solar Camera 2" : "Solar Camera"}
                  subtitle="Tapo C545d"
                  baseUrl={process.env.NEXT_PUBLIC_CCTV_HLS_URL}
                  hasLensToggle={true}
                  hasPtz={true}
                  envName="NEXT_PUBLIC_CCTV_HLS_URL"
                  cameraIp={process.env.NEXT_PUBLIC_CCTV_CAMERA_IP ?? "192.168.1.109"}
                  embedded={true}
                />
              </div>
              <hr className="border-white/10 shrink-0" />
              <div className="shrink-0">
                <CctvCard
                  title="DLC"
                  subtitle="Tapo C545d"
                  baseUrl={process.env.NEXT_PUBLIC_CCTV_HLS_URL_2}
                  hasLensToggle={true}
                  hasPtz={true}
                  envName="NEXT_PUBLIC_CCTV_HLS_URL_2"
                  cameraIp={process.env.NEXT_PUBLIC_CCTV_CAMERA_IP_2 ?? "192.168.1.106"}
                  embedded={true}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <ServerStatusStrip />
          <WeatherForecastCard forecast={weather} />
          <section className="glass premium-panel rounded-3xl p-5" id="plant-section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Solar & Utilization</h2>
              <div className="flex items-center gap-2 rounded-2xl bg-white/52 p-1 text-sm text-slate-500">
                <span className="rounded-xl bg-white px-4 py-2 shadow-sm">M</span>
                <span className="px-4 py-2">Y</span>
                <span className="px-4 py-2">T</span>
                <CalendarDays className="mx-2 h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 grid min-h-80 gap-5 2xl:grid-cols-2">
              <DonutPanel
                title="Consumption"
                value={`${metrics.monthlyLoadKwh.toFixed(1)} kWh`}
                data={utilizationData}
                colors={utilizationColors}
                emptyLabel="No live consumption"
              />
              <DonutPanel
                title="Production"
                value={`${metrics.monthlyProductionKwh.toFixed(1)} kWh`}
                data={productionMixData}
                colors={productionColors}
                emptyLabel="No live solar flow"
              />
            </div>
          </section>
        </section>

        <section className="mt-4 grid gap-4 2xl:grid-cols-[1.05fr_1fr]">
          <ChartPanel title="Power Profile" eyebrow="Realtime curve">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.history.power}>
                <CartesianGrid stroke="rgba(99,102,241,0.12)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis yAxisId="kw" stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,.92)", border: "1px solid rgba(129,140,248,.22)", borderRadius: 16, color: "#1e293b" }} />
                <Line yAxisId="kw" type="monotone" dataKey="solarKw" stroke="#22d3ee" strokeWidth={2.4} dot={false} name="Production" />
                <Line yAxisId="kw" type="monotone" dataKey="loadKw" stroke="#f6b516" strokeWidth={2.4} dot={false} name="Consumption" />
                <Line yAxisId="soc" type="monotone" dataKey="batterySoc" stroke="#2563eb" strokeWidth={2.4} dot={false} name="SOC %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Generation & Usage History" eyebrow="Monthly balance">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.history.dailyProduction}>
                <CartesianGrid stroke="rgba(99,102,241,0.12)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(71,85,105,0.62)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,.92)", border: "1px solid rgba(129,140,248,.22)", borderRadius: 16, color: "#1e293b" }} />
                <Bar dataKey="kwh" name="Daily Production" fill="#22c55e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="consumptionKwh" name="Daily Consumption" fill="#f6b516" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="mt-4 grid scroll-mt-4 gap-4 lg:grid-cols-4" id="devices-section">
          <MetricCard title="Battery SOC" value={`${metrics.batterySoc}%`} detail={batteryMode} icon={BatteryCharging} accent="bg-cyan-100 text-cyan-600" />
          <MetricCard title="Grid Import / Export" value={formatPower(metrics.gridPowerKw)} detail={metrics.gridPowerKw >= 0 ? "Importing from grid" : "Exporting to grid"} icon={PlugZap} accent="bg-indigo-100 text-indigo-600" />
          <MetricCard title="Battery Power" value={formatPower(metrics.batteryPowerKw)} detail={metrics.batteryPowerKw >= 0 ? "Discharge power" : "Charge power"} icon={Zap} accent="bg-teal-100 text-teal-600" />
          <MetricCard title="Monthly Load" value={metrics.monthlyLoadKwh.toFixed(0)} unit="kWh" detail="Consumption this month" icon={Home} accent="bg-orange-100 text-orange-600" />
        </section>

        <section className="mt-4 scroll-mt-4 glass premium-panel rounded-3xl p-5" id="alerts-section">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Risk Register</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Alarm & Error Log</h2>
            </div>
            <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-2">
              <AlertTriangle className="h-5 w-5 text-fuchsia-500" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.alarms.alarms.length > 0 ? (
              data.alarms.alarms.map((alarm) => <AlarmCard alarm={alarm} key={alarm.id} />)
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700">
                No active alarms.
              </div>
            )}
          </div>
        </section>

        <EnergyHistorySection />
      </main>
      <nav className="mobile-tabbar fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-0.5 border-t border-white/15 bg-slate-950/85 px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-2xl sm:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-500 to-fuchsia-400 text-white shadow-md shadow-indigo-500/20" : "text-slate-400"}`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span className="w-full truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
