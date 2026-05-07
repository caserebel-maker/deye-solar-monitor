"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  Building2,
  CloudOff,
  Cpu,
  Gauge,
  Home,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { Alarm, SolarAlarms, SolarHistory, SolarOverview } from "@/lib/deye-api";

type DashboardData = {
  overview: SolarOverview;
  history: SolarHistory;
  alarms: SolarAlarms;
};

const refreshMs = 45_000;

function formatKw(value: number) {
  return `${Math.abs(value).toFixed(2)} kW`;
}

function statusStyle(status: SolarOverview["status"]) {
  if (status === "error") return "border-rose-400/50 bg-rose-500/12 text-rose-100";
  if (status === "warning") return "border-amber-300/50 bg-amber-400/12 text-amber-100";
  if (status === "offline") return "border-slate-300/40 bg-slate-400/10 text-slate-200";
  return "border-emerald-300/50 bg-emerald-400/12 text-emerald-100";
}

function sourceLabel(source: DashboardData["overview"]["source"]) {
  return source === "live" ? "Live Deye Cloud API" : "Mock data";
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
    <section className={`glass premium-panel metric-card rounded-lg p-5 ${featured ? "sm:col-span-2 lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-lg border border-white/10 p-2.5 shadow-lg ${accent}`}>
          <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
        </div>
        <span className="rounded-full border border-white/10 bg-white/6 px-2 py-1 text-xs text-white/45">{unit}</span>
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/48">{title}</p>
        <p className={`data-readout mt-2 font-semibold tracking-normal text-white ${featured ? "text-5xl" : "text-3xl"}`}>
          {value}
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/55">
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
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-white/18 bg-black/28 px-3 text-center shadow-2xl backdrop-blur">
        <div className="rounded-full border border-white/12 bg-white/10 p-2">
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
        <span className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/48">{label}</span>
        <strong className="data-readout text-sm text-white">{value}</strong>
      </div>
    </foreignObject>
  );
}

function FlowLine({ from, to, value }: { from: [number, number]; to: [number, number]; value: number }) {
  if (value <= 0.02) return null;
  const width = Math.min(8, 2 + value);
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      stroke="url(#flowGradient)"
      strokeWidth={width}
      strokeLinecap="round"
      className="flow-line"
    />
  );
}

function EnergyFlow({ overview }: { overview: SolarOverview }) {
  const { metrics, flows } = overview;
  return (
    <section className="glass premium-panel rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200/60">Live Distribution</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Energy Flow Matrix</h2>
        </div>
        <div className="rounded-lg border border-emerald-200/20 bg-emerald-300/10 p-2">
          <Activity className="h-5 w-5 text-emerald-200" />
        </div>
      </div>
      <div className="mt-4 aspect-[1.25/1] min-h-80 w-full rounded-lg border border-white/10 bg-black/22 soft-grid">
        <svg viewBox="0 0 620 500" className="h-full w-full">
          <defs>
            <linearGradient id="flowGradient" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="48%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <FlowLine from={[310, 122]} to={[310, 244]} value={flows.solarToHomeKw} />
          <FlowLine from={[240, 122]} to={[140, 328]} value={flows.solarToBatteryKw} />
          <FlowLine from={[380, 122]} to={[500, 328]} value={flows.solarToGridKw} />
          <FlowLine from={[178, 345]} to={[262, 278]} value={flows.batteryToHomeKw} />
          <FlowLine from={[462, 345]} to={[358, 278]} value={flows.gridToHomeKw} />
          <FlowNode x={310} y={84} label="Solar" value={formatKw(metrics.solarKw)} icon={Sun} tone="text-yellow-200" />
          <FlowNode x={310} y={270} label="Home" value={formatKw(metrics.loadKw)} icon={Home} tone="text-emerald-200" />
          <FlowNode
            x={130}
            y={360}
            label="Battery"
            value={`${metrics.batterySoc}%`}
            icon={BatteryFull}
            tone="text-cyan-200"
          />
          <FlowNode
            x={500}
            y={360}
            label="Grid"
            value={formatKw(metrics.gridPowerKw)}
            icon={PlugZap}
            tone="text-blue-200"
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
    <section className="glass premium-panel rounded-lg p-5">
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/42">{eyebrow}</p>}
      <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
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
    loadData();
    const timer = window.setInterval(() => loadData(), refreshMs);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const metrics = data?.overview.metrics;
  const batteryMode = useMemo(() => {
    if (!metrics) return "";
    if (metrics.batteryPowerKw > 0.05) return `Charging ${formatKw(metrics.batteryPowerKw)}`;
    if (metrics.batteryPowerKw < -0.05) return `Discharging ${formatKw(metrics.batteryPowerKw)}`;
    return "Idle";
  }, [metrics]);

  if (isLoading) return <SkeletonDashboard />;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="glass premium-panel rounded-lg p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/18 bg-sky-200/8 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-sky-100/80">
                <Building2 className="h-3.5 w-3.5" />
                Executive Operations
              </span>
              {data && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/18 bg-emerald-200/8 px-3 py-1.5 text-xs font-medium text-emerald-100/80">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-300 text-emerald-300" />
                  {sourceLabel(data.overview.source)}
                </span>
              )}
            </div>
            <h1 className="executive-title mt-4 max-w-4xl bg-gradient-to-r from-white via-sky-100 to-cyan-200 bg-clip-text text-4xl font-semibold tracking-normal text-transparent sm:text-6xl">
              Deye Energy Command Center
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/58">
              Boardroom-grade view of generation, demand, storage and grid exposure across the Deye inverter stack.
            </p>
          </div>
          <div className="grid gap-3 sm:min-w-80">
            {data && (
              <div className={`rounded-lg border p-4 ${statusStyle(data.overview.status)}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] opacity-70">System Status</span>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{data.overview.status.toUpperCase()}</p>
              </div>
            )}
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-200/24 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-300/16 disabled:opacity-60"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 text-sm text-white/55 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Cpu className="h-4 w-4 text-emerald-200" />
            <span>Secure server-side telemetry</span>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-sky-100" />
            <span>Production, load and storage intelligence</span>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            {data && <span>Updated {new Date(data.overview.lastUpdated).toLocaleTimeString()}</span>}
            <span>Refresh {refreshMs / 1000}s</span>
          </div>
        </div>
      </header>

      {error && (
        <section className="mt-5 rounded-lg border border-rose-300/35 bg-rose-500/12 p-4 text-rose-100">
          <div className="flex items-center gap-2">
            <CloudOff className="h-5 w-5" />
            <strong>Data connection issue</strong>
          </div>
          <p className="mt-2 text-sm text-rose-100/75">{error}</p>
        </section>
      )}

      {data && metrics && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Solar Production" value={metrics.solarKw.toFixed(2)} unit="kW" detail="Current PV output" icon={Sun} accent="bg-sky-300/16 text-sky-100" featured />
            <MetricCard title="Home Load" value={metrics.loadKw.toFixed(2)} unit="kW" detail="Instant demand profile" icon={Home} accent="bg-blue-300/16 text-blue-100" featured />
            <MetricCard title="Battery SOC" value={`${metrics.batterySoc}%`} detail={batteryMode} icon={BatteryCharging} accent="bg-cyan-300/16 text-cyan-100" />
            <MetricCard title="Grid Import / Export" value={formatKw(metrics.gridPowerKw)} detail={metrics.gridPowerKw >= 0 ? "Importing from grid" : "Exporting to grid"} icon={PlugZap} accent="bg-blue-300/16 text-blue-100" />
            <MetricCard title="Battery Power" value={formatKw(metrics.batteryPowerKw)} detail={metrics.batteryPowerKw >= 0 ? "Charge power" : "Discharge power"} icon={Zap} accent="bg-teal-300/16 text-teal-100" />
            <MetricCard title="Today Production" value={metrics.todayProductionKwh.toFixed(1)} unit="kWh" detail="Energy generated today" icon={Gauge} accent="bg-lime-300/16 text-lime-100" />
            <MetricCard title="Monthly Production" value={metrics.monthlyProductionKwh.toFixed(0)} unit="kWh" detail="Current month total" icon={Activity} accent="bg-fuchsia-300/16 text-fuchsia-100" />
            <MetricCard title="Monthly Load" value={metrics.monthlyLoadKwh.toFixed(0)} unit="kWh" detail="Consumption this month" icon={Home} accent="bg-orange-300/16 text-orange-100" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_1.45fr]">
            <EnergyFlow overview={data.overview} />
            <div className="grid gap-4">
              <ChartPanel title="Daily Production" eyebrow="Generation Yield">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.history.dailyProduction}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#0a171d", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8 }} />
                    <Bar dataKey="kwh" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Load vs Solar" eyebrow="Intraday Balance">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history.power}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0a171d", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="solarKw" stroke="#38bdf8" fill="#38bdf82e" strokeWidth={2.5} name="Solar kW" />
                  <Area type="monotone" dataKey="loadKw" stroke="#2563eb" fill="#2563eb28" strokeWidth={2.5} name="Load kW" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>
            <ChartPanel title="Battery SOC History" eyebrow="Storage Position">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history.power}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0a171d", border: "1px solid rgba(255,255,255,.14)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="batterySoc" stroke="#67e8f9" strokeWidth={3} dot={false} name="SOC %" />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="mt-4 glass premium-panel rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/42">Risk Register</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Alarm & Error Log</h2>
              </div>
              <div className="rounded-lg border border-sky-200/20 bg-sky-300/10 p-2">
                <AlertTriangle className="h-5 w-5 text-sky-200" />
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {data.alarms.alarms.length > 0 ? (
                data.alarms.alarms.map((alarm) => <AlarmCard alarm={alarm} key={alarm.id} />)
              ) : (
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  No active alarms.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
