"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BatteryFull,
  Camera,
  CloudSun,
  CloudOff,
  Cpu,
  Home,
  PlugZap,
  RefreshCw,
  Sun,
  Zap,
} from "lucide-react";
import type { SolarOverview, SolarHistory } from "@/lib/deye-api";
import type { WeatherForecast } from "@/lib/weather";

type DashboardData = {
  overview: SolarOverview;
  history: SolarHistory;
};

const refreshMs = 30_000;

function formatPower(value: number) {
  const abs = Math.abs(value);
  if (abs < 1) return `${(abs * 1000).toFixed(2)} W`;
  return `${abs.toFixed(2)} kW`;
}

function formatEnergyToday(value: number) {
  return value.toFixed(2);
}

function weatherIcon(code: number, isDay = true) {
  if (code === 0) return isDay ? Sun : CloudSun;
  if (code === 1 || code === 2) return CloudSun;
  return CloudSun;
}

function weatherTone(code: number, isDay = true) {
  return "text-amber-400";
}

/* Base Flow Path & Moving Flow Path for Energy Flow Matrix */
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

function FlowPath({ d, value, color, delay = "0s" }: { d: string; value: number; color: string; delay?: string }) {
  if (value <= 0.005) return null;
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
        <span className={`${compact ? "mt-1 text-[9px] tracking-[0.12em]" : "mt-2 text-[11px] tracking-[0.14em]"} font-medium uppercase text-slate-500`}>
          {label}
        </span>
        <strong className={`data-readout text-slate-950 ${compact ? "text-xs" : "text-sm"}`}>{value}</strong>
      </div>
    </foreignObject>
  );
}

/* TV CCTV Player Component - Forcing SD stream for TV stability with auto-reconnect */
function TvCctvPlayer({ src, label, subtitle }: { src: string; label: string; subtitle: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("loading");
    const onPlaying = () => setStatus("live");
    const onWaiting = () => setStatus("loading");
    const onStalled = () => setStatus("loading");
    const onError = () => setStatus("error");

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);

    // Format HLS stream URL to fragmented MP4 with target stream _sd for stability
    let targetUrl = src;
    try {
      const u = new URL(src);
      u.pathname = u.pathname.replace(/stream\.m3u8$/, "stream.mp4");
      const originalSrc = u.searchParams.get("src") || "tapo";
      const prefix = originalSrc.startsWith("tapo_2") ? "tapo_2" : "tapo";
      u.searchParams.set("src", `${prefix}_sd`); // Force SD stream for TV stability
      u.searchParams.set("_t", Date.now().toString()); // Cache buster
      targetUrl = u.toString();
    } catch {
      // Fallback
    }

    video.src = targetUrl;
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
  }, [src, retryCount]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      console.log(`[TV-Kiosk] Stream stalled for 5s: ${label}. Reconnecting...`);
      setRetryCount((c) => c + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, label]);

  const dotClass = status === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-300";

  return (
    <section className="glass premium-panel flex flex-col rounded-3xl p-4 flex-1 min-h-0">
      {/* Header bar matching main dashboard */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Security Feed</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 leading-none">{label}</h2>
          <p className="mt-1 text-[10px] font-medium text-slate-500">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-indigo-100 bg-white/55 p-1.5">
            <Camera className="h-4 w-4 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Video Content area */}
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-slate-950 border border-white/10 shadow-lg">
        {src ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            controls={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/40">
            <Camera className="h-8 w-8 text-white/20 mx-auto" />
            <p className="mt-2 text-xs text-white/50">Camera URL not configured</p>
          </div>
        )}

        {/* Floating status badge on video */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] text-white/90 z-10 border border-white/5">
          <span className="flex items-center gap-1.5 font-medium">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            {status === "live" ? "Lens A · Fixed" : "Connecting..."}
          </span>
          <span className="text-[9px] font-bold text-white/50 bg-white/10 px-1 py-0.5 rounded font-mono uppercase">fMP4</span>
        </div>

        {/* Connection error panel */}
        {status === "error" && src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-20">
            <Camera className="h-8 w-8 text-rose-500 animate-pulse" />
            <p className="mt-2 text-xs font-bold text-white tracking-wide">Stream Offline</p>
            <p className="mt-1 text-[10px] text-white/40">Auto-recovering...</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TvDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  // Live Digital Clock (updated every second)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setDateStr(
        now.toLocaleDateString("th-TH", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Telemetry fetching logic
  const loadData = useCallback(async () => {
    try {
      const [overview, history, forecast] = await Promise.all([
        fetch("/api/solar/overview", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/solar/history", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/weather/forecast", { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ]);

      if (overview.error || history.error) {
        throw new Error(overview.error ?? history.error);
      }

      setData({ overview, history });
      if (forecast && !forecast.error) setWeather(forecast as WeatherForecast);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load solar data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 30-second telemetry polling
  useEffect(() => {
    void loadData();
    const timer = setInterval(loadData, refreshMs);
    return () => clearInterval(timer);
  }, [loadData]);

  // Full-page watchdog: Reload every 2 hours to clear memory leaks
  useEffect(() => {
    const watchdog = setTimeout(() => {
      console.log("[TV-Kiosk] Performing 2-hour full page refresh...");
      window.location.reload();
    }, 2 * 60 * 60 * 1000);
    return () => clearTimeout(watchdog);
  }, []);

  const metrics = data?.overview.metrics;
  const flows = data?.overview.flows;

  // Paths for Energy Flow SVG diagram
  const paths = useMemo(
    () => ({
      solarToInverter: "M 90 119 V 175 Q 90 195 110 195 H 280",
      batteryToInverter: "M 90 281 V 225 Q 90 205 110 205 H 280",
      inverterToBattery: "M 280 205 H 110 Q 90 205 90 225 V 281",
      gridToInverter: "M 610 119 V 175 Q 610 195 590 195 H 420",
      inverterToGrid: "M 420 195 H 590 Q 610 195 610 175 V 119",
      inverterToUps: "M 350 248 V 281",
      inverterToHome: "M 420 205 H 590 Q 610 205 610 225 V 281",
    }),
    []
  );

  // Render Skeleton Loading Screen
  if (isLoading || !metrics || !flows) {
    return (
      <div className="w-screen h-screen bg-[#040910] flex flex-col items-center justify-center text-white font-sans">
        <Activity className="h-16 w-16 text-cyan-400 animate-pulse" />
        <h2 className="mt-4 text-xl font-bold tracking-widest text-cyan-200">725 SOLAR SYSTEM</h2>
        <p className="mt-2 text-sm text-slate-500">Loading kiosk telemetry...</p>
      </div>
    );
  }

  // Energy Flow calculations
  const solarToInverter = metrics.solarKw;
  const batteryToInverter = flows.batteryToHomeKw;
  const inverterToBattery = flows.solarToBatteryKw;
  const gridToInverter = metrics.gridPowerKw >= 0 ? Math.max(metrics.gridPowerKw, flows.gridToHomeKw, 0) : 0;
  const inverterToGrid = metrics.gridPowerKw < 0 ? Math.max(Math.abs(metrics.gridPowerKw), flows.solarToGridKw, 0) : 0;
  const inverterToUps = metrics.loadKw;
  const gridLabel = gridToInverter > 0.005 ? "Grid Import" : inverterToGrid > 0.005 ? "Grid Export" : "Grid";
  const gridValue = gridToInverter || inverterToGrid;

  return (
    <div className="dark-dashboard w-screen h-screen overflow-hidden bg-[#040910] text-[#e2ecf8] font-sans p-4 flex flex-col gap-4 select-none">
      
      {/* HEADER SECTION - Matches main page header layout exactly */}
      <header className="flex justify-between items-center bg-white/38 border border-white/60 px-4 py-2.5 rounded-3xl shadow-xl backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold leading-none text-slate-950">725</h1>
          <span className="rounded-full bg-white/50 px-2.5 py-0.5 text-xs text-slate-500 font-semibold">10kWp</span>
          
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/75 px-2 py-0.5 text-emerald-700 font-bold">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              online
            </span>
            <span className="truncate opacity-80">Online Inverter 1 · Live Deye Cloud API</span>
            <span className="opacity-60">Last update {new Date(data?.overview.lastUpdated || "").toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Digital Clock and Date in Header */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xl font-black font-mono tracking-wider text-slate-950 leading-none">
              {time}
            </span>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wide">
              {dateStr}
            </span>
          </div>
        </div>
      </header>

      {/* CONTENT GRID - Two Columns, fitting exactly in viewport */}
      <div className="flex-1 min-h-0 flex flex-row gap-4">
        
        {/* LEFT COLUMN: Energy Flow Matrix (48% width) */}
        <div className="w-[48%] h-full flex flex-col">
          <section className="glass premium-panel rounded-3xl p-4 flex-1 flex flex-col justify-between min-h-0">
            {/* Title block */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] eyebrow-text">Live Distribution</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Energy Flow Matrix</h2>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white/55 p-2">
                <Activity className="h-5 w-5 text-indigo-500" />
              </div>
            </div>

            {/* SVG Canvas Area */}
            <div className="energy-flow-canvas mt-3 flex-1 min-h-0 w-full overflow-hidden rounded-3xl border border-white/60 bg-white/34 soft-grid flex items-center justify-center">
              <svg viewBox="0 0 700 400" className="h-full w-full max-h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="flowGradient" x1="0" x2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="48%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
                {solarToInverter <= 0.005 && <BaseFlowPath d={paths.solarToInverter} />}
                {batteryToInverter <= 0.005 && inverterToBattery <= 0.005 && <BaseFlowPath d={paths.batteryToInverter} />}
                {gridToInverter <= 0.005 && inverterToGrid <= 0.005 && <BaseFlowPath d={paths.gridToInverter} />}
                <BaseFlowPath d={paths.inverterToHome} />
                {inverterToUps <= 0.005 && <BaseFlowPath d={paths.inverterToUps} />}
                
                <FlowPath d={paths.solarToInverter} value={solarToInverter} color="#fbbf24" delay="0s" />
                <FlowPath d={paths.batteryToInverter} value={batteryToInverter} color="#fbbf24" delay="-0.45s" />
                <FlowPath d={paths.inverterToBattery} value={inverterToBattery} color="#10b981" delay="-0.45s" />
                <FlowPath d={paths.gridToInverter} value={gridToInverter} color="#38bdf8" delay="-0.9s" />
                <FlowPath d={paths.inverterToGrid} value={inverterToGrid} color="#38bdf8" delay="-0.9s" />
                <FlowPath d={paths.inverterToUps} value={inverterToUps} color="#a78bfa" delay="-1.25s" />
                
                <FlowNode compact x={90} y={80} label="Solar" value={formatPower(metrics.solarKw)} icon={Sun} tone="text-amber-400" />
                <FlowNode x={350} y={200} label="Inverter" value="Hybrid" icon={Cpu} tone="text-indigo-500" />
                <FlowNode compact x={350} y={320} label="UPS Load" value={formatPower(metrics.loadKw)} icon={Home} tone="text-violet-500" />
                <FlowNode
                  compact
                  x={90}
                  y={320}
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
                <FlowNode compact x={610} y={320} label="Home Load" value="0 W" icon={Home} tone="text-emerald-500" />
              </svg>
            </div>

            {/* Bottom 4-column Stats Row - Matches main page layout exactly */}
            <div className="mt-3 grid grid-cols-4 gap-2.5 rounded-3xl border border-white/55 bg-white/45 p-3 backdrop-blur">
              <div className="rounded-2xl bg-white/35 px-3 py-2 flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] eyebrow-text truncate">Monthly Production</p>
                <p className="data-readout mt-0.5 text-base font-black text-slate-950 truncate">
                  {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-[10px] font-semibold">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-3 py-2 flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] eyebrow-text truncate">Monthly Load</p>
                <p className="data-readout mt-0.5 text-base font-black text-slate-950 truncate">
                  {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-[10px] font-semibold">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-3 py-2 flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] eyebrow-text truncate">Daily Production</p>
                <p className="data-readout mt-0.5 text-base font-black text-slate-950 truncate">
                  {formatEnergyToday(metrics.todayProductionKwh)} <span className="text-[10px] font-semibold">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-3 py-2 flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] eyebrow-text truncate">Weather</p>
                <p className="data-readout mt-0.5 flex items-center gap-1 text-base font-black text-slate-950 truncate">
                  {weather && weather.source === "live" ? (
                    <>
                      {createElement(weatherIcon(weather.current.weatherCode, weather.current.isDay), { className: "h-4 w-4 shrink-0 text-amber-400" })}
                      <span>{Math.round(weather.current.temperatureC)}°C</span>
                    </>
                  ) : (
                    "32 °C"
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Stacked CCTV Live Feeds (52% width) */}
        <div className="w-[52%] h-full flex flex-col gap-4">
          <TvCctvPlayer
            src={process.env.NEXT_PUBLIC_CCTV_HLS_URL || ""}
            label="Solar Camera"
            subtitle="Tapo C545d · Lens A · Close-up & Fixed"
          />

          <TvCctvPlayer
            src={process.env.NEXT_PUBLIC_CCTV_HLS_URL_2 || ""}
            label="DLC"
            subtitle="Tapo C545d · Lens A · Close-up & Fixed"
          />
        </div>
      </div>

      {/* Global Connection issue overlay */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-rose-950/95 border border-rose-500/30 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-rose-200 z-50 animate-bounce shadow-2xl">
          <span className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 text-rose-400" />
            <strong className="font-bold">Connection Issue:</strong> {error}
          </span>
          <span className="text-[10px] uppercase font-bold bg-white/10 px-2 py-0.5 rounded text-rose-300">
            Retrying...
          </span>
        </div>
      )}
    </div>
  );
}
