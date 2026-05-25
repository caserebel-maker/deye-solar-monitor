"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BatteryCharging,
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
  if (abs < 1) return `${Math.round(abs * 1000)} W`;
  return `${abs.toFixed(2)} kW`;
}

function formatEnergyToday(value: number) {
  return value.toFixed(1);
}

function weatherIcon(code: number, isDay = true) {
  if (code === 0) return isDay ? Sun : CloudSun; // fallback to cloud sun for TV UI if no moon
  if (code === 1 || code === 2) return CloudSun;
  return CloudSun;
}

function weatherTone(code: number, isDay = true) {
  return "text-amber-400";
}

/* TV CCTV Player Component - Forces SD stream and automatically reloads on stall */
function TvCctvPlayer({ src, label }: { src: string; label: string }) {
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

    // Parse base URL and format as fragmented MP4 with target stream _sd for stability
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

  // Reconnect watchdog: if stuck in loading for 5 seconds, reload the stream source
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      console.log(`[TV-Kiosk] Stream stalled for 5s: ${label}. Reconnecting...`);
      setRetryCount((c) => c + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, label]);

  const dotClass =
    status === "live"
      ? "bg-emerald-500 animate-pulse"
      : status === "error"
        ? "bg-rose-500"
        : "bg-amber-500 animate-pulse";

  return (
    <div className="relative flex-1 h-[calc(50%-0.5rem)] rounded-[1.5rem] overflow-hidden bg-slate-950/90 border border-white/10 shadow-2xl flex flex-col justify-center items-center">
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
        <div className="text-center p-4">
          <Camera className="h-10 w-10 text-white/20 mx-auto" />
          <p className="mt-2 text-sm text-white/50">Camera URL not configured</p>
        </div>
      )}

      {/* Header overlay */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-center bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 z-10">
        <span className="flex items-center gap-2 text-xs font-semibold text-white tracking-wide">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          {label}
        </span>
        <span className="text-[9px] font-bold text-white/60 bg-white/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
          {status === "live" ? "fMP4 Live" : status === "error" ? "Offline" : "Connecting"}
        </span>
      </div>

      {/* Connection error panel */}
      {status === "error" && src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-20">
          <Camera className="h-10 w-10 text-rose-500 animate-pulse" />
          <p className="mt-3 text-sm font-bold text-white tracking-wide">Camera Feed Offline</p>
          <p className="mt-1 text-xs text-white/40">Attempting auto-recovery...</p>
        </div>
      )}
    </div>
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

  // Full-page watchdog: Reload every 2 hours to clear RAM and caches
  useEffect(() => {
    const watchdog = setTimeout(() => {
      console.log("[TV-Kiosk] Performing 2-hour full page refresh...");
      window.location.reload();
    }, 2 * 60 * 60 * 1000);
    return () => clearTimeout(watchdog);
  }, []);

  const metrics = data?.overview.metrics;
  const flows = data?.overview.flows;

  // Render Skeleton Loading Screen
  if (isLoading || !metrics) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <Activity className="h-16 w-16 text-cyan-400 animate-pulse" />
        <h2 className="mt-4 text-xl font-bold tracking-widest text-cyan-200">725 SOLAR SYSTEM</h2>
        <p className="mt-2 text-sm text-slate-500">Loading kiosk telemetry...</p>
      </div>
    );
  }

  // Battery current state label
  const batteryState =
    metrics.batteryPowerKw > 0.05
      ? `Discharging · ${formatPower(metrics.batteryPowerKw)}`
      : metrics.batteryPowerKw < -0.05
        ? `Charging · ${formatPower(Math.abs(metrics.batteryPowerKw))}`
        : "Idle";

  // Grid import/export label
  const gridState =
    metrics.gridPowerKw > 0.05
      ? "Importing from Grid"
      : metrics.gridPowerKw < -0.05
        ? "Exporting to Grid"
        : "Standby";

  return (
    <div className="dark-dashboard w-screen h-screen overflow-hidden bg-[#040910] text-[#e2ecf8] font-sans p-4 flex flex-row gap-4 select-none">
      {/* LEFT COLUMN: Telemetry & Clock (40% width) */}
      <div className="w-[40%] h-full flex flex-col gap-4 justify-between">
        
        {/* Header Block: Clock, Date, Weather, Status */}
        <header className="flex justify-between items-center bg-white/5 border border-white/10 rounded-3xl p-4 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black font-mono tracking-wider text-white leading-none">
              {time}
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1 tracking-wide uppercase">
              {dateStr}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {weather && weather.source === "live" && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl shadow-inner">
                {createElement(weatherIcon(weather.current.weatherCode, weather.current.isDay), {
                  className: `h-5 w-5 ${weatherTone(weather.current.weatherCode, weather.current.isDay)}`,
                  strokeWidth: 2.2,
                })}
                <span className="text-sm font-black text-white font-mono">
                  {Math.round(weather.current.temperatureC)}°C
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
              <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {data?.overview.status || "Online"}
              </span>
            </div>
          </div>
        </header>

        {/* 2x2 Telemetry Metrics Cards */}
        <section className="grid grid-cols-2 gap-4 flex-1 my-1">
          {/* Card 1: Solar Production */}
          <div className="flex flex-col justify-between bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <Sun className="h-6 w-6 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                Solar PV
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                {formatPower(metrics.solarKw)}
              </p>
              <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Today: {formatEnergyToday(metrics.todayProductionKwh)} kWh
              </p>
            </div>
          </div>

          {/* Card 2: Home Load */}
          <div className="flex flex-col justify-between bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl">
                <Home className="h-6 w-6 text-fuchsia-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                UPS Load
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                {formatPower(metrics.loadKw)}
              </p>
              <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                Today: {formatEnergyToday(metrics.todayLoadKwh)} kWh
              </p>
            </div>
          </div>

          {/* Card 3: Battery Status */}
          <div className="flex flex-col justify-between bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                <BatteryCharging className="h-6 w-6 text-cyan-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                Battery
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                {metrics.batterySoc}%
              </p>
              <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-1.5 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                {batteryState}
              </p>
            </div>
          </div>

          {/* Card 4: Grid Connection */}
          <div className="flex flex-col justify-between bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                <PlugZap className="h-6 w-6 text-blue-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                Grid Flow
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                {formatPower(metrics.gridPowerKw)}
              </p>
              <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${metrics.gridPowerKw >= 0 ? "bg-red-400" : "bg-emerald-400"}`} />
                {gridState}
              </p>
            </div>
          </div>
        </section>

        {/* Real-time history chart card */}
        <section className="bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg flex-1 min-h-[160px] max-h-[220px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xs font-bold text-white tracking-widest uppercase">
              Power Profile (24h Trend)
            </h2>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="h-1.5 w-3 bg-cyan-400 rounded-full" /> Production
              </span>
              <span className="flex items-center gap-1 text-fuchsia-300">
                <span className="h-1.5 w-3 bg-fuchsia-400 rounded-full" /> Consumption
              </span>
              <span className="flex items-center gap-1 text-blue-300">
                <span className="h-1.5 w-3 bg-blue-500 rounded-full" /> Battery %
              </span>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full min-h-0">
            {data && data.history.power.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.history.power} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis yAxisId="kw" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} axisLine={false} />
                  <Line yAxisId="kw" type="monotone" dataKey="solarKw" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="kw" type="monotone" dataKey="loadKw" stroke="#e879f9" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="soc" type="monotone" dataKey="batterySoc" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-white/20">
                No history data available
              </div>
            )}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: Stacked CCTV Live Streams (60% width) */}
      <div className="w-[60%] h-full flex flex-col gap-4">
        {/* Stream 1: Solar Camera */}
        <TvCctvPlayer
          src={process.env.NEXT_PUBLIC_CCTV_HLS_URL || ""}
          label="Solar Camera (Tapo C545d)"
        />

        {/* Stream 2: DLC Camera */}
        <TvCctvPlayer
          src={process.env.NEXT_PUBLIC_CCTV_HLS_URL_2 || ""}
          label="DLC Camera (Tapo C545d)"
        />
      </div>

      {/* Connection issue overlay (subtle at bottom if there is an error) */}
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
