"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  CloudSun,
  CloudOff,
  Cpu,
  Info,
  Home,
  Moon,
  PlugZap,
  RefreshCw,
  Sun,
  Zap,
} from "lucide-react";
import type { Alarm, SolarAlarms, SolarHistory, SolarOverview } from "@/lib/deye-api";

type DashboardData = {
  overview: SolarOverview;
  history: SolarHistory;
  alarms: SolarAlarms;
};

type ThemeMode = "light" | "dark";
type ActiveTab = "overview" | "devices" | "alerts" | "plant";
const refreshMs = 30_000;
const utilizationColors = ["#7c3aed", "#38bdf8", "#22c55e"];
const productionColors = ["#2563eb", "#f6b516", "#f472b6"];
const tabs: Array<{ id: ActiveTab; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: ChartSpline },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "plant", label: "Plant Info", icon: Info },
];
type DonutItem = { name: string; value: number };

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
  if (status === "error") return "border-rose-200 bg-rose-50/75 text-rose-700";
  if (status === "warning") return "border-amber-200 bg-amber-50/75 text-amber-700";
  if (status === "offline") return "border-slate-200 bg-slate-50/75 text-slate-600";
  return "border-emerald-200 bg-emerald-50/75 text-emerald-700";
}

function sourceLabel(source: DashboardData["overview"]["source"]) {
  return source === "live" ? "Live Deye Cloud API" : "Mock data";
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function donutPercent(item: DonutItem, items: DonutItem[]) {
  const total = items.reduce((sum, current) => sum + current.value, 0);
  return percent(item.value, total);
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

function HeroStats({ metrics }: { metrics: SolarOverview["metrics"] }) {
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
          <CloudSun className="h-8 w-8 shrink-0 text-slate-950" strokeWidth={2.2} />
          33<span className="text-lg font-bold">°C</span>
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
  const width = compact ? 118 : 140;
  const height = compact ? 82 : 96;
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

function FlowPath({ d, value, delay = "0s" }: { d: string; value: number; delay?: string }) {
  if (value <= 0.005) return null;
  const width = Math.min(8, 2 + value * 1.35);
  return (
    <>
      <path d={d} stroke="url(#flowGradient)" strokeWidth={width} strokeLinecap="round" fill="none" className="flow-line" />
      <circle r="6" fill="#3b82f6" className="flow-pulse-dot">
        <animateMotion dur="1.9s" begin={delay} repeatCount="indefinite" path={d} />
      </circle>
      <circle r="3.5" fill="#ffffff" opacity="0.82">
        <animateMotion dur="1.9s" begin={delay} repeatCount="indefinite" path={d} />
      </circle>
    </>
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

function MobileActiveFlowPath({
  d,
  value,
  delay,
}: {
  d: string;
  value: number;
  delay: string;
}) {
  if (value <= 0.005) return null;

  return (
    <>
      <path
        d={d}
        stroke="rgba(248, 250, 252, 0.9)"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="mobile-active-flow-line"
      />
      <circle r="5.2" fill="#3b82f6" stroke="#8bb8ff" strokeWidth="2.1" className="mobile-flow-dot">
        <animateMotion dur="1.9s" begin={delay} repeatCount="indefinite" path={d} />
      </circle>
    </>
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

function EnergyFlow({ overview }: { overview: SolarOverview }) {
  const { metrics, flows } = overview;
  const solarToInverter = metrics.solarKw;
  const batteryToInverter = flows.batteryToHomeKw;
  const inverterToBattery = flows.solarToBatteryKw;
  const gridToInverter = metrics.gridPowerKw >= 0 ? Math.max(metrics.gridPowerKw, flows.gridToHomeKw, 0) : 0;
  const inverterToGrid = metrics.gridPowerKw < 0 ? Math.max(Math.abs(metrics.gridPowerKw), flows.solarToGridKw, 0) : 0;
  const inverterToUps = metrics.loadKw;
  const gridLabel = gridToInverter > 0.005 ? "Grid Import" : inverterToGrid > 0.005 ? "Grid Export" : "Grid";
  const gridValue = gridToInverter || inverterToGrid;
  const paths = {
    solarToInverter: "M 168 132 V 210 H 336 V 216",
    batteryToInverter: "M 168 330 V 294 H 268",
    inverterToBattery: "M 268 294 H 168 V 330",
    gridToInverter: "M 504 132 V 210 H 336 V 216",
    inverterToGrid: "M 336 216 V 210 H 504 V 132",
    inverterToUps: "M 336 312 V 372",
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/70">Live Distribution</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Energy Flow Matrix</h2>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
          <Activity className="h-5 w-5 text-indigo-500" />
        </div>
      </div>
      <div className="energy-flow-canvas relative mt-3 h-[500px] w-full overflow-hidden rounded-3xl border border-white/60 bg-white/34 soft-grid lg:mt-4 lg:h-auto lg:aspect-[1.55/1] lg:min-h-[470px]">
        <svg viewBox="0 0 620 500" className="hidden h-full w-[72%] lg:block" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="flowGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="48%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <BaseFlowPath d={paths.solarToInverter} />
          <BaseFlowPath d={paths.batteryToInverter} />
          <BaseFlowPath d={paths.gridToInverter} />
          <BaseFlowPath d={paths.inverterToUps} />
          <FlowPath d={paths.solarToInverter} value={solarToInverter} delay="0s" />
          <FlowPath d={paths.batteryToInverter} value={batteryToInverter} delay="-0.45s" />
          <FlowPath d={paths.inverterToBattery} value={inverterToBattery} delay="-0.45s" />
          <FlowPath d={paths.gridToInverter} value={gridToInverter} delay="-0.9s" />
          <FlowPath d={paths.inverterToGrid} value={inverterToGrid} delay="-0.9s" />
          <FlowPath d={paths.inverterToUps} value={inverterToUps} delay="-1.25s" />
          <FlowNode x={168} y={84} label="Solar" value={formatPower(metrics.solarKw)} icon={Sun} tone="text-amber-400" />
          <FlowNode x={336} y={264} label="Inverter" value="Hybrid" icon={Cpu} tone="text-indigo-500" />
          <FlowNode x={336} y={420} label="UPS Load" value={formatPower(metrics.loadKw)} icon={Home} tone="text-violet-500" />
          <FlowNode
            x={168}
            y={378}
            label="Battery"
            value={`${metrics.batterySoc}% · ${formatPower(metrics.batteryPowerKw)}`}
            icon={BatteryFull}
            tone="text-cyan-500"
          />
          <FlowNode
            x={504}
            y={84}
            label={gridLabel}
            value={formatPower(gridValue)}
            icon={PlugZap}
            tone="text-blue-500"
          />
        </svg>
        <div className="absolute bottom-5 right-5 hidden w-[25%] min-w-[220px] rounded-3xl border border-white/55 bg-white/50 p-4 shadow-2xl backdrop-blur-xl lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-500/70">Plant Summary</p>
          <div className="mt-3 grid gap-3">
            <div>
              <p className="text-xs text-slate-500">Accumulative production</p>
              <p className="data-readout mt-1 text-2xl font-black leading-none text-slate-950">
                {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-xs font-bold">kWh</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Accumulative consumption</p>
              <p className="data-readout mt-1 text-2xl font-black leading-none text-slate-950">
                {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-xs font-bold">kWh</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/55 pt-3">
              <div>
                <p className="text-[11px] text-slate-500">Daily Production</p>
                <p className="data-readout mt-1 text-lg font-black text-slate-950">
                  {formatEnergyToday(metrics.todayProductionKwh)} <span className="text-[10px]">kWh</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Weather</p>
                <p className="data-readout mt-1 flex items-center gap-1 text-lg font-black text-slate-950">
                  <CloudSun className="h-4 w-4" /> 33 <span className="text-[10px]">°C</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-full w-full overflow-hidden lg:hidden">
          <svg viewBox="0 0 360 460" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <BaseFlowPath d={mobilePaths.solarToInverter} />
            <BaseFlowPath d={mobilePaths.batteryToInverter} />
            <BaseFlowPath d={mobilePaths.gridToInverter} />
            <BaseFlowPath d={mobilePaths.inverterToUps} />
            <BaseFlowPath d={mobilePaths.inverterToLoad} />
            <MobileActiveFlowPath d={mobilePaths.solarToInverter} value={solarToInverter} delay="0s" />
            <MobileActiveFlowPath d={batteryToInverter > 0.005 ? mobilePaths.batteryToInverter : mobilePaths.inverterToBattery} value={Math.max(batteryToInverter, inverterToBattery)} delay="-0.45s" />
            <MobileActiveFlowPath d={gridToInverter > 0.005 ? mobilePaths.gridToInverter : mobilePaths.inverterToGrid} value={Math.max(gridToInverter, inverterToGrid)} delay="-0.9s" />
            <MobileActiveFlowPath d={mobilePaths.inverterToUps} value={inverterToUps} delay="-1.25s" />
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
            status={gridToInverter > 0.005 ? "On grid" : undefined}
            value={formatCompactPower(gridValue)}
            icon={PlugZap}
            tone="text-white"
          />
          <MobileFlowNode className="left-[78%] top-[84%]" label="Load" value="0 W" icon={Home} tone="text-white" />
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
              <CloudSun className="h-4 w-4" /> 33 <span className="text-xs">°C</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CctvCard() {
  return (
    <section className="glass premium-panel flex min-h-[470px] flex-col rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/60">Security Feed</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Tapo CCTV Monitor</h2>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
          <Camera className="h-5 w-5 text-indigo-500" />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/55 bg-slate-950/75 shadow-2xl">
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
            <p className="mt-4 text-sm font-semibold text-white">Tapo camera slot ready</p>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/55">
              Prepared for a TP-Link Tapo RTSP/HLS bridge. Feed will stay server-side/proxy-safe before showing here.
            </p>
          </div>
        </div>
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
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/60">{eyebrow}</p>}
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = window.localStorage.getItem("deye-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });

  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      setError(null);
      const [overview, history, alarms] = await Promise.all([
        fetch("/api/solar/overview", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/solar/history", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/solar/alarms", { cache: "no-store" }).then((response) => response.json()),
      ]);

      if (overview.error || history.error || alarms.error) {
        throw new Error(overview.error ?? history.error ?? alarms.error);
      }

      setData({ overview, history, alarms });
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
    const run = () => {
      void loadData();
    };
    const initial = window.setTimeout(run, 0);
    const timer = window.setInterval(run, refreshMs);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
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
    <div className={`${theme === "dark" ? "dark-dashboard" : "light-dashboard"} min-h-screen px-3 pb-24 pt-3 sm:px-5 sm:pb-4 lg:px-6`}>
      <main className="mx-auto max-w-[1860px]" id="dashboard-top">
        <header className="mb-3 flex flex-col gap-2 rounded-[1.4rem] border border-white/60 bg-white/38 px-3 py-2.5 shadow-xl shadow-indigo-500/10 backdrop-blur-2xl sm:mb-4 sm:gap-3 sm:rounded-3xl sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold leading-none text-slate-950 sm:text-xl">725</h1>
              <button className="rounded-full bg-white/60 p-2 text-slate-600 shadow-sm" onClick={() => loadData(true)} type="button">
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
            <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:flex sm:flex-wrap sm:gap-3 sm:text-sm">
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${statusStyle(data.overview.status)}`}>
                <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" />
                {data.overview.status}
              </span>
              <span className="min-w-0 truncate">Online Inverter 1 · {sourceLabel(data.overview.source)}</span>
              <span className="col-span-2 truncate sm:col-span-1">Last update {new Date(data.overview.lastUpdated).toLocaleString()}</span>
            </div>
            <div className="mt-3 sm:hidden">
              <HeroStats metrics={metrics} />
            </div>
          </div>
          <nav className="hidden gap-2 overflow-x-auto text-sm font-medium text-slate-600 sm:flex lg:flex">
            <button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white/42 px-3 py-2 text-slate-600"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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

        {error && (
          <section className="mb-4 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-rose-700 backdrop-blur">
            <div className="flex items-center gap-2">
              <CloudOff className="h-5 w-5" />
              <strong>Data connection issue</strong>
            </div>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <EnergyFlow overview={data.overview} />
          <CctvCard />
        </section>

        <section className="mt-4 grid gap-4">
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
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/60">Risk Register</p>
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
      </main>
      <nav className="mobile-tabbar fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-[1.5rem] border border-white/60 bg-white/80 p-1.5 shadow-2xl backdrop-blur-2xl sm:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1.5 text-[11px] font-semibold ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-500 to-fuchsia-400 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500"}`}
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
