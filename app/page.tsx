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
  CloudOff,
  Cpu,
  Home,
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

const refreshMs = 45_000;
const utilizationColors = ["#7c3aed", "#38bdf8", "#22c55e"];
const productionColors = ["#2563eb", "#f6b516", "#f472b6"];
type DonutItem = { name: string; value: number };

function formatPower(value: number) {
  const abs = Math.abs(value);
  if (abs < 1) return `${(abs * 1000).toFixed(2)} W`;
  return `${abs.toFixed(2)} kW`;
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

function FlowNode({
  x,
  y,
  label,
  value,
  icon: Icon,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  icon: typeof Sun;
  tone: string;
}) {
  return (
    <foreignObject x={x - 70} y={y - 48} width="140" height="96">
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/58 px-3 text-center shadow-2xl backdrop-blur">
        <div className="rounded-full border border-indigo-100 bg-white/70 p-2">
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
        <span className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <strong className="data-readout text-sm text-slate-950">{value}</strong>
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

function EnergyFlow({ overview }: { overview: SolarOverview }) {
  const { metrics, flows } = overview;
  const solarToInverter = metrics.solarKw;
  const batteryToInverter = flows.batteryToHomeKw;
  const inverterToBattery = flows.solarToBatteryKw;
  const gridToInverter = flows.gridToHomeKw;
  const inverterToGrid = flows.solarToGridKw;
  const inverterToUps = metrics.loadKw;
  const paths = {
    solarToInverter: "M 175 125 H 270 Q 310 125 310 165 V 214",
    batteryToInverter: "M 170 357 V 284 Q 170 250 204 250 H 252",
    inverterToBattery: "M 252 288 H 204 Q 170 288 170 322 V 357",
    gridToInverter: "M 500 125 H 365 Q 330 125 330 165 V 214",
    inverterToGrid: "M 368 246 H 438 Q 500 246 500 184 V 125",
    inverterToUps: "M 310 314 V 392",
  };
  return (
    <section className="glass premium-panel rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/70">Live Distribution</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Energy Flow Matrix</h2>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
          <Activity className="h-5 w-5 text-indigo-500" />
        </div>
      </div>
      <div className="mt-4 aspect-[1.25/1] min-h-80 w-full rounded-3xl border border-white/60 bg-white/34 soft-grid">
        <svg viewBox="0 0 620 500" className="h-full w-full">
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
          <FlowNode x={175} y={84} label="Solar" value={formatPower(metrics.solarKw)} icon={Sun} tone="text-amber-400" />
          <FlowNode x={310} y={264} label="Inverter" value="Hybrid" icon={Cpu} tone="text-indigo-500" />
          <FlowNode x={310} y={436} label="UPS Load" value={formatPower(metrics.loadKw)} icon={Home} tone="text-violet-500" />
          <FlowNode
            x={130}
            y={360}
            label="Battery"
            value={`${metrics.batterySoc}% · ${formatPower(metrics.batteryPowerKw)}`}
            icon={BatteryFull}
            tone="text-cyan-500"
          />
          <FlowNode
            x={500}
            y={84}
            label="Grid"
            value={formatPower(metrics.gridPowerKw)}
            icon={PlugZap}
            tone="text-blue-500"
          />
        </svg>
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

  if (isLoading) return <SkeletonDashboard />;
  if (!data || !metrics) return null;

  return (
    <div className="min-h-screen px-3 py-4 sm:px-5 lg:px-6">
      <main className="mx-auto max-w-[1860px]">
        <header className="mb-4 flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/38 px-4 py-3 shadow-xl shadow-indigo-500/10 backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-950">คุณ สายัณห์</h1>
              <button className="rounded-full bg-white/60 p-2 text-slate-600 shadow-sm" onClick={() => loadData(true)}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <span className="hidden rounded-full bg-white/50 px-3 py-1 text-sm text-slate-500 sm:inline-flex">10kWp</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${statusStyle(data.overview.status)}`}>
                <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" />
                {data.overview.status}
              </span>
              <span>Online Inverter 1</span>
              <span>{sourceLabel(data.overview.source)}</span>
              <span>Last update {new Date(data.overview.lastUpdated).toLocaleString()}</span>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto text-sm font-medium text-slate-600">
            {["Overview", "Devices", "Alerts", "Plant Info"].map((item, index) => (
              <span
                className={`rounded-2xl px-4 py-2 ${index === 0 ? "bg-gradient-to-r from-indigo-500 to-fuchsia-400 text-white shadow-lg shadow-indigo-500/20" : "bg-white/42"}`}
                key={item}
              >
                {item}
              </span>
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

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr_1.8fr]">
          <EnergyFlow overview={data.overview} />

          <div className="grid gap-4">
            <section className="glass premium-panel rounded-3xl p-5">
              <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
              <div className="mt-8 grid gap-8">
                <div className="flex items-center gap-5">
                  <div className="rounded-3xl bg-indigo-100 p-4 text-indigo-600">
                    <Zap className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Accumulative production</p>
                    <p className="data-readout mt-2 text-3xl font-semibold text-slate-950">
                      {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-sm">kWh</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="rounded-3xl bg-blue-100 p-4 text-blue-600">
                    <Home className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Accumulative consumption</p>
                    <p className="data-readout mt-2 text-3xl font-semibold text-slate-950">
                      {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-sm">kWh</span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="glass premium-panel rounded-3xl p-5">
              <div className="grid grid-cols-2 divide-x divide-indigo-100">
                <div className="px-2">
                  <p className="text-sm text-slate-500">Daily Production</p>
                  <p className="data-readout mt-3 text-3xl font-semibold text-slate-950">
                    {metrics.todayProductionKwh.toFixed(1)} <span className="text-sm">kWh</span>
                  </p>
                </div>
                <div className="px-5">
                  <p className="text-sm text-slate-500">Weather</p>
                  <p className="data-readout mt-3 text-3xl font-semibold text-slate-950">33 <span className="text-sm">°C</span></p>
                </div>
              </div>
            </section>
          </div>

          <section className="glass premium-panel rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Solar & Utilization</h2>
              <div className="flex items-center gap-2 rounded-2xl bg-white/52 p-1 text-sm text-slate-500">
                <span className="rounded-xl bg-white px-4 py-2 shadow-sm">M</span>
                <span className="px-4 py-2">Y</span>
                <span className="px-4 py-2">T</span>
                <CalendarDays className="mx-2 h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 grid min-h-80 gap-5 lg:grid-cols-2">
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

        <section className="mt-4 grid gap-4 lg:grid-cols-4">
          <MetricCard title="Battery SOC" value={`${metrics.batterySoc}%`} detail={batteryMode} icon={BatteryCharging} accent="bg-cyan-100 text-cyan-600" />
          <MetricCard title="Grid Import / Export" value={formatPower(metrics.gridPowerKw)} detail={metrics.gridPowerKw >= 0 ? "Importing from grid" : "Exporting to grid"} icon={PlugZap} accent="bg-indigo-100 text-indigo-600" />
          <MetricCard title="Battery Power" value={formatPower(metrics.batteryPowerKw)} detail={metrics.batteryPowerKw >= 0 ? "Discharge power" : "Charge power"} icon={Zap} accent="bg-teal-100 text-teal-600" />
          <MetricCard title="Monthly Load" value={metrics.monthlyLoadKwh.toFixed(0)} unit="kWh" detail="Consumption this month" icon={Home} accent="bg-orange-100 text-orange-600" />
        </section>

        <section className="mt-4 glass premium-panel rounded-3xl p-5">
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
    </div>
  );
}
