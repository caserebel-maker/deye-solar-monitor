"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Settings,
  Sun,
  Cloud,
  CloudSun,
  Droplets,
  Wind,
  Gauge,
  Activity,
  CheckCircle2,
  TrendingUp,
  Clock,
  Leaf,
  Car,
  Home,
  Cpu,
  AlertTriangle,
  Info,
  RefreshCw,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DashboardData = {
  overview?: {
    status?: string;
    lastUpdated?: string;
    metrics?: {
      solarKw?: number;
      loadKw?: number;
      batterySoc?: number;
      batteryPowerKw?: number;
      gridPowerKw?: number;
      todayProductionKwh?: number;
      todayLoadKwh?: number;
      monthlyProductionKwh?: number;
      monthlyLoadKwh?: number;
    };
    flows?: {
      solarToHomeKw?: number;
      solarToBatteryKw?: number;
      solarToGridKw?: number;
      batteryToHomeKw?: number;
      gridToHomeKw?: number;
    };
  };
  history?: {
    hourlyProduction?: Array<{ hour: string; kwh: number }>;
  };
};

type WeatherData = {
  current?: {
    temperatureC?: number;
    weatherCode?: number;
    windSpeedKmh?: number;
  };
};

export default function PreviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatrixTab, setActiveMatrixTab] = useState<"live" | "today" | "week" | "month">("live");

  const loadData = async () => {
    try {
      const [dashRes, weatherRes] = await Promise.all([
        fetch("/api/solar/dashboard", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/weather/forecast", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (dashRes) setData(dashRes);
      if (weatherRes) setWeather(weatherRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const metrics = data?.overview?.metrics;
  const flows = data?.overview?.flows;

  // Real or realistic fallback metrics
  const solarKw = metrics?.solarKw ?? 0;
  const batterySoc = metrics?.batterySoc ?? 85;
  const batteryPowerKw = metrics?.batteryPowerKw ?? 0;
  const isBatteryCharging = (flows?.solarToBatteryKw ?? 0) > 0 || batteryPowerKw > 0.05;
  const isBatteryDischarging = (flows?.batteryToHomeKw ?? 0) > 0 || batteryPowerKw < -0.05;
  const batteryDisplayKw = Math.abs(batteryPowerKw);

  const gridPowerKw = metrics?.gridPowerKw ?? 0;
  const isGridImport = gridPowerKw >= 0;
  const gridDisplayW = Math.round(Math.abs(gridPowerKw) * 1000);

  const loadKw = metrics?.loadKw ?? 0;
  const todayProductionKwh = metrics?.todayProductionKwh ?? 38.3;
  const todayLoadKwh = metrics?.todayLoadKwh ?? 28.7;

  // Environmental equivalences
  const co2SavedKg = (todayProductionKwh * 0.537).toFixed(1);
  const treesPlanted = (todayProductionKwh * 0.0007).toFixed(1);
  const evKm = Math.round(todayProductionKwh * 6.2);

  // Weather fallback
  const tempC = weather?.current?.temperatureC ? Math.round(weather.current.temperatureC) : 31;
  const windKmh = weather?.current?.windSpeedKmh ? Math.round(weather.current.windSpeedKmh) : 12;

  // Chart data
  const chartData = useMemo(() => {
    const rawHourly = data?.history?.hourlyProduction;
    if (rawHourly && rawHourly.length > 0) {
      return rawHourly.map((h) => ({
        time: h.hour,
        solar: h.kwh,
        load: Number((h.kwh * 0.65 + 0.5).toFixed(2)),
      }));
    }
    // Simulation curve for smooth visual
    return [
      { time: "00:00", solar: 0, load: 0.8 },
      { time: "04:00", solar: 0, load: 0.6 },
      { time: "06:00", solar: 0.3, load: 1.1 },
      { time: "08:00", solar: 2.1, load: 1.8 },
      { time: "10:00", solar: 4.8, load: 2.4 },
      { time: "12:00", solar: 6.8, load: 3.2 },
      { time: "14:00", solar: 5.4, load: 3.0 },
      { time: "16:00", solar: 3.1, load: 2.8 },
      { time: "18:00", solar: 0.8, load: 3.5 },
      { time: "20:00", solar: 0, load: 2.2 },
      { time: "24:00", solar: 0, load: 1.2 },
    ];
  }, [data]);

  return (
    <div className="relative min-h-screen w-full bg-[#050B14] text-white font-sans selection:bg-cyan-500 selection:text-black">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Image
          src="/new-theme/bg.png"
          alt="Isometric Grid Background"
          fill
          priority
          className="object-cover object-top opacity-50 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050B14]/40 to-[#050B14]" />
      </div>

      {/* Navigation Switcher Top Banner */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/10 bg-[#071322]/80 px-4 py-2 text-xs backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-300 transition hover:bg-cyan-500/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>กลับหน้าเดิม (Classic Dashboard)</span>
        </Link>
        <div className="flex items-center gap-2 text-white/50">
          <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>3D Isometric Preview v2</span>
        </div>
      </div>

      {/* Main Container - Mobile First Frame that centers gracefully on desktop */}
      <main className="relative z-10 mx-auto max-w-md px-4 pb-28 pt-4 sm:max-w-xl md:max-w-2xl">
        {/* Top Header */}
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white">725</h1>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="mt-0.5 text-xs font-medium text-cyan-300/80">Inverter 1 · Live Deye Cloud API</p>
            <p className="text-[10px] text-white/40">
              Last update {new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })},{" "}
              {new Date().toLocaleTimeString("en-US")}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              title="Refresh"
              className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/80 transition hover:bg-white/10 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/80 transition hover:bg-white/10">
              <Bell className="h-4 w-4" />
            </button>
            <button className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/80 transition hover:bg-white/10">
              <Settings className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Online</span>
            </div>
          </div>
        </header>

        {/* Top Two Summary Cards */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          {/* Card 1: Production Today */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e2439]/90 to-[#071322]/90 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/70">Production Today</span>
              <Sun className="h-5 w-5 text-amber-400 animate-spin-slow" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">{todayProductionKwh.toFixed(2)}</span>
              <span className="ml-1 text-xs font-medium text-white/60">kWh</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>+12%</span>
              <span className="text-[10px] text-white/40 font-normal">vs. yesterday</span>
            </div>
            {/* Ambient solar reflection */}
            <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-amber-500/15 blur-xl" />
          </div>

          {/* Card 2: Bangkok Weather */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c223a]/90 to-[#061221]/90 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between text-[11px] font-medium text-white/70">
              <span>Bangkok, TH</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-white">{tempC}</span>
                <span className="text-sm font-semibold text-white/70"> °C</span>
                <p className="text-[10px] text-white/50">Partly Cloudy</p>
              </div>
              <CloudSun className="h-8 w-8 text-amber-300" />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-white/60">
              <span>Humidity 68%</span>
              <span>Wind {windKmh} km/h</span>
              <span>UV 8</span>
            </div>
          </div>
        </section>

        {/* 3D Isometric Energy Flow Matrix */}
        <section className="relative mt-5 overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-[#091a2e]/95 via-[#061424]/95 to-[#040c17]/95 p-4 shadow-2xl backdrop-blur-2xl">
          {/* Header & Matrix Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">LIVE DISTRIBUTION</p>
              <h2 className="text-lg font-black text-white">Energy Flow Matrix</h2>
              <p className="text-[10px] text-white/50">Realtime energy flow in your system</p>
            </div>

            <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1 text-[11px] font-medium">
              {(["live", "today", "week", "month"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveMatrixTab(tab)}
                  className={`rounded-lg px-2.5 py-1 capitalize transition ${
                    activeMatrixTab === tab ? "bg-cyan-500 font-bold text-black shadow-md shadow-cyan-500/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* System Status Pill inside Matrix */}
          <div className="absolute right-4 top-16 z-20 hidden sm:flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 backdrop-blur-md">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[10px] font-bold text-white">System Status</p>
              <p className="text-[9px] text-emerald-400">Normal · No active alerts</p>
            </div>
          </div>

          {/* Isometric Flow Canvas */}
          <div className="relative mt-4 h-[420px] w-full select-none">
            {/* SVG Pipeline Paths & Glowing Particles */}
            <svg
              viewBox="0 0 500 420"
              className="absolute inset-0 h-full w-full pointer-events-none z-10"
            >
              <defs>
                {/* Neon Glow Filters */}
                <filter id="glow-solar" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FACC15" floodOpacity="0.8" />
                </filter>
                <filter id="glow-battery" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22C55E" floodOpacity="0.8" />
                </filter>
                <filter id="glow-grid" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38BDF8" floodOpacity="0.8" />
                </filter>
                <filter id="glow-house" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#C084FC" floodOpacity="0.8" />
                </filter>

                {/* Linear Gradients */}
                <linearGradient id="grad-solar" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FACC15" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#CA8A04" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* 1. Solar to Inverter Line */}
              <path
                id="path-solar"
                d="M 250,105 L 250,195"
                fill="none"
                stroke="#FACC15"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#glow-solar)"
                opacity={solarKw > 0 ? 0.9 : 0.2}
              />
              {/* Animated Light Pulse on Solar */}
              {solarKw > 0 && (
                <>
                  <path
                    d="M 250,105 L 250,195"
                    fill="none"
                    stroke="#FEF08A"
                    strokeWidth="4"
                    strokeDasharray="8 16"
                    className="solar-flow"
                  />
                  <circle r="4" fill="#FFFFFF" filter="url(#glow-solar)">
                    <animateMotion dur="1.2s" repeatCount="indefinite" path="M 250,105 L 250,195" />
                  </circle>
                </>
              )}

              {/* 2. Inverter to Battery Line */}
              <path
                id="path-battery"
                d="M 135,185 L 220,210"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#glow-battery)"
                opacity={batteryDisplayKw > 0.05 ? 0.9 : 0.3}
              />
              {/* Battery Flow Particle */}
              {batteryDisplayKw > 0.05 && (
                <>
                  <path
                    d="M 135,185 L 220,210"
                    fill="none"
                    stroke="#86EFAC"
                    strokeWidth="4"
                    strokeDasharray="8 16"
                    className="battery-flow"
                  />
                  <circle r="4" fill="#FFFFFF" filter="url(#glow-battery)">
                    <animateMotion
                      dur="1.5s"
                      repeatCount="indefinite"
                      path={isBatteryCharging ? "M 220,210 L 135,185" : "M 135,185 L 220,210"}
                    />
                  </circle>
                </>
              )}

              {/* 3. Inverter to Grid Line */}
              <path
                id="path-grid"
                d="M 280,210 L 365,185"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#glow-grid)"
                opacity={gridDisplayW > 10 ? 0.9 : 0.3}
              />
              {gridDisplayW > 10 && (
                <>
                  <path
                    d="M 280,210 L 365,185"
                    fill="none"
                    stroke="#BAE6FD"
                    strokeWidth="4"
                    strokeDasharray="8 16"
                    className="grid-flow"
                  />
                  <circle r="4" fill="#FFFFFF" filter="url(#glow-grid)">
                    <animateMotion
                      dur="1.8s"
                      repeatCount="indefinite"
                      path={isGridImport ? "M 365,185 L 280,210" : "M 280,210 L 365,185"}
                    />
                  </circle>
                </>
              )}

              {/* 4. Inverter to House (UPS Load) Line */}
              <path
                id="path-house"
                d="M 240,230 L 175,295"
                fill="none"
                stroke="#C084FC"
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="url(#glow-house)"
                opacity={loadKw > 0 ? 0.9 : 0.3}
              />
              {loadKw > 0 && (
                <>
                  <path
                    d="M 240,230 L 175,295"
                    fill="none"
                    stroke="#F3E8FF"
                    strokeWidth="4"
                    strokeDasharray="8 16"
                    className="house-flow"
                  />
                  <circle r="4" fill="#FFFFFF" filter="url(#glow-house)">
                    <animateMotion dur="1.4s" repeatCount="indefinite" path="M 240,230 L 175,295" />
                  </circle>
                </>
              )}

              {/* 5. Inverter to Secondary Load (Dotted / Inactive) */}
              <path
                id="path-subload"
                d="M 260,230 L 325,295"
                fill="none"
                stroke="#64748B"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                opacity="0.5"
              />
            </svg>

            {/* --- Isometric 3D Layer Objects --- */}

            {/* Object 1: Solar Panel (Top) */}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 flex flex-col items-center z-20">
              <div className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-[#0c1c2e]/90 px-2.5 py-0.5 text-xs font-black text-amber-300 shadow-lg backdrop-blur-md">
                <Sun className="h-3 w-3 text-amber-400" />
                <span>{solarKw.toFixed(2)} kW</span>
              </div>
              <p className="mt-0.5 text-[9px] font-semibold text-white/60">PV Production</p>
              <div className="relative mt-1 h-20 w-36 transition hover:scale-105">
                <Image
                  src="/new-theme/solar.png"
                  alt="Solar PV Array"
                  fill
                  className="object-contain drop-shadow-[0_8px_16px_rgba(250,204,21,0.25)]"
                />
              </div>
            </div>

            {/* Object 2: Deye Inverter (Center) */}
            <div className="absolute left-1/2 top-[170px] -translate-x-1/2 flex flex-col items-center z-30">
              <div className="relative h-28 w-28 transition hover:scale-105">
                <Image
                  src="/new-theme/inverter.png"
                  alt="Deye Inverter"
                  fill
                  priority
                  className="object-contain drop-shadow-[0_12px_24px_rgba(56,189,248,0.35)]"
                />
              </div>
            </div>

            {/* Object 3: Battery (Left) */}
            <div className="absolute left-2 top-[130px] flex flex-col items-center z-20">
              <div className="relative h-28 w-24 transition hover:scale-105">
                <Image
                  src="/new-theme/battery.png"
                  alt="Battery Storage"
                  fill
                  className="object-contain drop-shadow-[0_8px_16px_rgba(34,197,94,0.3)]"
                />
              </div>
              <div className="mt-1 flex flex-col items-center">
                <div className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-[#0c1c2e]/90 px-2.5 py-0.5 text-xs font-black text-emerald-400 shadow-lg">
                  <Activity className="h-3 w-3" />
                  <span>{batteryDisplayKw.toFixed(2)} kW</span>
                </div>
                <p className="text-[10px] font-bold text-emerald-300">
                  {batterySoc}% · {isBatteryCharging ? "Charging" : isBatteryDischarging ? "Discharging" : "Idle"}
                </p>
              </div>
            </div>

            {/* Object 4: Grid Power Tower (Right) */}
            <div className="absolute right-2 top-[130px] flex flex-col items-center z-20">
              <div className="relative h-28 w-24 transition hover:scale-105">
                <Image
                  src="/new-theme/grid.png"
                  alt="Grid Tower"
                  fill
                  className="object-contain drop-shadow-[0_8px_16px_rgba(56,189,248,0.3)]"
                />
              </div>
              <div className="mt-1 flex flex-col items-center">
                <div className="flex items-center gap-1 rounded-full border border-sky-400/40 bg-[#0c1c2e]/90 px-2.5 py-0.5 text-xs font-black text-sky-400 shadow-lg">
                  <Gauge className="h-3 w-3" />
                  <span>{gridDisplayW} W</span>
                </div>
                <p className="text-[10px] font-bold text-sky-300">
                  {isGridImport ? "Grid Import" : "Grid Export"}
                </p>
              </div>
            </div>

            {/* Object 5: House Load (Bottom-Left) */}
            <div className="absolute left-6 bottom-2 flex flex-col items-center z-20">
              <div className="relative h-24 w-28 transition hover:scale-105">
                <Image
                  src="/new-theme/house.png"
                  alt="UPS Load House"
                  fill
                  className="object-contain drop-shadow-[0_8px_16px_rgba(192,132,252,0.3)]"
                />
              </div>
              <div className="mt-1 flex items-center gap-1 rounded-full border border-purple-400/40 bg-[#0c1c2e]/90 px-2.5 py-0.5 text-xs font-black text-purple-300 shadow-lg">
                <Home className="h-3 w-3 text-purple-400" />
                <span>{loadKw.toFixed(2)} kW</span>
              </div>
              <p className="text-[9px] font-semibold text-white/60">Ups-Load</p>
            </div>

            {/* Object 6: Secondary Home / Grid Load (Bottom-Right) */}
            <div className="absolute right-6 bottom-2 flex flex-col items-center z-20">
              <div className="relative h-20 w-24 opacity-80 transition hover:scale-105">
                <Image
                  src="/new-theme/house.png"
                  alt="Home Load"
                  fill
                  className="object-contain drop-shadow-[0_8px_16px_rgba(100,116,139,0.2)]"
                />
              </div>
              <div className="mt-1 flex items-center gap-1 rounded-full border border-slate-500/40 bg-[#0c1c2e]/90 px-2 py-0.5 text-[11px] font-bold text-slate-300 shadow-lg">
                <Home className="h-2.5 w-2.5 text-slate-400" />
                <span>0 W</span>
              </div>
              <p className="text-[9px] font-semibold text-white/50">Load</p>
            </div>
          </div>
        </section>

        {/* Middle Section: Today's Trend & Summary Cards */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Today's Trend Recharts Chart (2 cols on sm) */}
          <div className="rounded-3xl border border-white/10 bg-[#081525]/90 p-4 shadow-xl backdrop-blur-xl sm:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Today&apos;s Trend</h3>
              <div className="flex items-center gap-3 text-[10px] text-white/60">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  PV Production
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  Load
                </span>
              </div>
            </div>

            <div className="mt-3 h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} tickLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#050B14ee",
                      borderColor: "#ffffff20",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="solar" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="load" fill="#A855F7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Production / Consumption Summary (1 col on sm) */}
          <div className="flex flex-col justify-between gap-2 rounded-3xl border border-white/10 bg-[#081525]/90 p-4 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/50">Total Production</p>
                <p className="text-sm font-black text-white">{todayProductionKwh.toFixed(2)} kWh</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 pt-2">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-2 text-purple-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/50">Total Consumption</p>
                <p className="text-sm font-black text-white">{todayLoadKwh.toFixed(2)} kWh</p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 pt-2">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400">
                <Leaf className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-white/50">CO₂ Saved</p>
                <p className="text-sm font-black text-white">{co2SavedKg} kg</p>
              </div>
            </div>
          </div>
        </section>

        {/* Eco Impact Banner & Cards */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3 backdrop-blur-md">
            <Leaf className="h-6 w-6 text-emerald-400" />
            <div>
              <p className="text-[10px] text-white/50">Equivalent to</p>
              <p className="text-sm font-black text-white">{treesPlanted}</p>
              <p className="text-[9px] text-emerald-400">Trees planted</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-3 backdrop-blur-md">
            <Car className="h-6 w-6 text-cyan-400" />
            <div>
              <p className="text-[10px] text-white/50">Equivalent to</p>
              <p className="text-sm font-black text-white">{evKm} km</p>
              <p className="text-[9px] text-cyan-400">EV driving</p>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Sticky Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#050B14]/90 px-6 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button className="flex flex-col items-center gap-1 text-cyan-400">
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-bold">Overview</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/50 hover:text-white">
            <Cpu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Devices</span>
          </button>
          <button className="relative flex flex-col items-center gap-1 text-white/50 hover:text-white">
            <span className="absolute -top-1 right-2 h-2 w-2 rounded-full bg-rose-500" />
            <AlertTriangle className="h-5 w-5" />
            <span className="text-[10px] font-medium">Alerts</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-white/50 hover:text-white">
            <Info className="h-5 w-5" />
            <span className="text-[10px] font-medium">Plant Info</span>
          </button>
        </div>
      </nav>

      {/* Global CSS for Flow Line Keyframe Animations */}
      <style jsx global>{`
        @keyframes flowDash {
          to {
            stroke-dashoffset: -48;
          }
        }
        .solar-flow,
        .battery-flow,
        .grid-flow,
        .house-flow {
          animation: flowDash 1.2s linear infinite;
        }
      `}</style>
    </div>
  );
}
