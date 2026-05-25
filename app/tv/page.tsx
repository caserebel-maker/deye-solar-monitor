"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Activity,
  BatteryFull,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudSun,
  CloudOff,
  Cpu,
  Home,
  PlugZap,
  RefreshCw,
  Square,
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

function renderValue(value: string, compact: boolean) {
  const powerRegex = /^([\d.-]+)\s*(kW|W)$/i;
  const match = value.match(powerRegex);
  if (match) {
    const num = match[1];
    const unit = match[2];
    return (
      <div className="flex items-baseline justify-center leading-none mt-1">
        <strong className="data-readout text-slate-950 font-black text-5xl tracking-tighter">
          {num}
        </strong>
        <span className="text-xs font-black text-slate-500 ml-0.5">
          {unit}
        </span>
      </div>
    );
  }

  if (value.includes("·")) {
    const parts = value.split("·").map((p) => p.trim());
    const soc = parts[0];
    const power = parts[1];
    return (
      <div className="flex flex-col items-center justify-center leading-none mt-0.5">
        <strong className="data-readout text-slate-950 font-black text-5xl tracking-tighter">
          {soc}
        </strong>
        <span className="text-[10px] font-bold text-slate-500 mt-1 leading-none">
          {power}
        </span>
      </div>
    );
  }

  return (
    <strong className="data-readout text-slate-950 font-black text-4xl leading-none mt-1 tracking-tight">
      {value}
    </strong>
  );
}

/* Flow Node Component - Optimized side-by-side layout for maximum text space */
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
  const width = compact ? 176 : 210;
  const height = compact ? 90 : 106;
  return (
    <foreignObject x={x - width / 2} y={y - height / 2} width={width} height={height}>
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/58 px-2 text-center shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 mb-1">
          <div className="rounded-full border border-indigo-50 bg-white/80 p-1">
            <Icon className={`h-5.5 w-5.5 ${tone}`} />
          </div>
          <span className={`${compact ? "text-lg" : "text-xl"} font-black uppercase tracking-[0.05em] text-slate-500`}>
            {label}
          </span>
        </div>
        {renderValue(value, compact)}
      </div>
    </foreignObject>
  );
}

/* PTZ Control Panel for TV WebView */
function TvCctvPtzControls({ cameraIp }: { cameraIp?: string }) {
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
        className: `flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/82 transition hover:bg-white/12 hover:text-white disabled:opacity-40 ${classes}`,
      },
      createElement(Icon, { className: "h-4.5 w-4.5" }),
    );

  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-3.5 py-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] eyebrow-text-inset">Pan / Tilt</p>
        <p className="mt-0.5 text-[10px] text-white/55 truncate max-w-[180px]">
          {error ? <span className="text-rose-300">{error}</span> : pending ? `Moving ${pending}…` : "ขยับกล้องเลนส์ B"}
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

/* TV CCTV Player Component - Forcing SD stream, support Lens Toggle, PTZ control, and object-contain */
function TvCctvPlayer({
  src,
  label,
  subtitle,
  cameraIp,
}: {
  src: string;
  label: string;
  subtitle: string;
  cameraIp: string;
}) {
  const [lens, setLens] = useState<"lens_a" | "lens_b">("lens_a");
  const [restartCount, setRestartCount] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);

  // Compute stream URL with lens options (always HLS for Hls.js compatibility)
  const streamUrl = useMemo(() => {
    if (!src) return undefined;
    try {
      const u = new URL(src);
      const originalSrc = u.searchParams.get("src") || "tapo";
      const prefix = originalSrc.startsWith("tapo_2") ? "tapo_2" : "tapo";
      const targetSrc = lens === "lens_b" ? `${prefix}_lens_b_sd` : `${prefix}_sd`; // Force SD stream for TV stability
      
      u.searchParams.set("src", targetSrc);
      u.searchParams.set("_t", `${Date.now()}-${restartCount}`); // Cache buster
      return u.toString();
    } catch {
      return src;
    }
  }, [src, lens, restartCount]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setStatus("loading");
    const onPlaying = () => setStatus("live");
    const onWaiting = () => setStatus("loading");
    const onStalled = () => setStatus("loading");
    const onError = () => setStatus("error");
    const onLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoAspectRatio(video.videoWidth / video.videoHeight);
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);

    let hlsInstance: Hls | null = null;

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        maxBufferSize: 0, // Disable buffer size limits to prevent memory pressure on budget TV
        maxBufferLength: 4, // Minimal buffer for near-real-time streaming
        liveBackBufferLength: 0,
        enableWorker: true, // Run parser in Web Worker to prevent UI stuttering
      });

      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => {
          console.log("hls.js playback blocked:", err);
        });
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("hls.js fatal network error, retrying startLoad...");
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("hls.js fatal media error, retrying recoverMediaError...");
              hlsInstance?.recoverMediaError();
              break;
            default:
              console.log("hls.js unrecoverable fatal error");
              setStatus("error");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") || video.canPlayType("application/x-mpegURL")) {
      // Native HLS fallback (e.g. Safari / iOS)
      video.src = streamUrl;
      video.play().catch((err) => {
        console.log("Native HLS video playback blocked:", err);
      });
    } else {
      console.log("HLS is not supported on this platform.");
      setStatus("error");
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);

      if (hlsInstance) {
        hlsInstance.destroy();
      } else {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [streamUrl, retryCount]);

  // Reconnect watchdog: if stuck in loading for 5 seconds, reload the stream source
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      console.log(`[TV-Kiosk] Stream stalled for 5s: ${label}. Reconnecting...`);
      setRetryCount((c) => c + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, label]);

  const restartStream = useCallback(async () => {
    if (!src || restarting) return;
    setRestarting(true);
    try {
      const origin = new URL(src).origin;
      await fetch(`${origin}/api/restart`, { method: "POST", mode: "no-cors" }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 6000));
      setRestartCount((n) => n + 1);
    } finally {
      setRestarting(false);
    }
  }, [src, restarting]);

  // Fallback interactive click handler to trigger play on click/tap
  const handleContainerClick = () => {
    const video = videoRef.current;
    if (video) {
      video.play().catch((err) => console.log("Play on click failed: ", err));
    }
  };

  const dotClass = status === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-300";
  const activeLensLabel = lens === "lens_b" ? "Lens B · Wide" : "Lens A · Fixed";

  return (
    <section className="glass premium-panel flex min-h-0 flex-1 basis-1/2 flex-col rounded-3xl p-4">
      {/* Header bar matching main dashboard */}
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-400/90 leading-none">CCTV Security</p>
          <h2 className="mt-1 text-sm font-black text-slate-900 leading-tight">{label}</h2>
          <p className="mt-0.5 text-[10px] font-black text-slate-500/80 leading-tight">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Lens toggles */}
          <div className="flex overflow-hidden rounded-xl border border-indigo-100 bg-white/55 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setLens("lens_a")}
              className={`px-2.5 py-1.5 transition ${lens === "lens_a" ? "bg-indigo-500 text-white" : "text-slate-600 hover:bg-white/80"}`}
            >
              Lens A
            </button>
            <button
              type="button"
              onClick={() => setLens("lens_b")}
              className={`px-2.5 py-1.5 transition ${lens === "lens_b" ? "bg-indigo-500 text-white" : "text-slate-600 hover:bg-white/80"}`}
            >
              Lens B
            </button>
          </div>

          {/* Restart button */}
          <button
            aria-label="Restart stream"
            onClick={restartStream}
            disabled={restarting}
            type="button"
            className="rounded-xl border border-indigo-100 bg-white/55 p-1.5 text-indigo-500 transition disabled:opacity-50"
            title="Restart stream"
          >
            <RefreshCw className={`h-4 w-4 ${restarting ? "animate-spin" : ""}`} />
          </button>

          <div className="rounded-xl border border-indigo-100 bg-white/55 p-1.5">
            <Camera className="h-4 w-4 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Video area: preserve native aspect ratio and let the panel background fill leftover space. */}
      <div 
        onClick={handleContainerClick}
        className="relative flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.18),transparent_24rem),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.9))] shadow-lg"
      >
        {src ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ aspectRatio: videoAspectRatio }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              controls={false}
              className="block max-h-full max-w-full bg-transparent object-contain"
              style={{
                aspectRatio: videoAspectRatio,
                width: "100%",
                height: "auto",
              }}
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900/40">
            <Camera className="h-8 w-8 text-white/20 mx-auto" />
            <p className="mt-2 text-xs text-white/50">Camera URL not configured</p>
          </div>
        )}

        {/* Floating status badge on video */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] text-white/90 z-10 border border-white/5">
          <span className="flex items-center gap-1.5 font-medium">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            {status === "live" ? activeLensLabel : "Connecting..."}
          </span>
          <span className="text-[9px] font-bold text-white/50 bg-white/10 px-1 py-0.5 rounded font-mono uppercase">HLS</span>
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

      {/* PTZ controls displayed if Lens B is selected, identical to main page */}
      {lens === "lens_b" && <TvCctvPtzControls cameraIp={cameraIp} />}
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

  // Paths for Energy Flow SVG diagram (shifted up and down to match node layout coordinates)
  const paths = useMemo(
    () => ({
      solarToInverter: "M 90 100 V 115 Q 90 135 110 135 H 245",
      batteryToInverter: "M 90 300 V 165 Q 90 145 110 145 H 245",
      inverterToBattery: "M 245 145 H 110 Q 90 145 90 165 V 300",
      gridToInverter: "M 610 100 V 115 Q 610 135 590 135 H 455",
      inverterToGrid: "M 455 135 H 590 Q 610 135 610 115 V 100",
      inverterToUps: "M 350 193 V 300",
      inverterToHome: "M 455 145 H 590 Q 610 145 610 165 V 300",
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

            {/* SVG Canvas Area - Shifted y positions to expand spacing and prevent vertical overlaps */}
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
                
                {/* Repositioned: Solar/Grid moved up (y=55), Inverter moved up (y=140), Battery/Load/Home moved down (y=345) */}
                <FlowNode compact x={90} y={55} label="Solar" value={formatPower(metrics.solarKw)} icon={Sun} tone="text-amber-400" />
                <FlowNode x={350} y={140} label="Inverter" value="Hybrid" icon={Cpu} tone="text-indigo-500" />
                <FlowNode compact x={350} y={345} label="UPS Load" value={formatPower(metrics.loadKw)} icon={Home} tone="text-violet-500" />
                <FlowNode
                  compact
                  x={90}
                  y={345}
                  label="Battery"
                  value={`${metrics.batterySoc}% · ${formatPower(metrics.batteryPowerKw)}`}
                  icon={BatteryFull}
                  tone="text-cyan-500"
                />
                <FlowNode
                  compact
                  x={610}
                  y={55}
                  label={gridLabel}
                  value={formatPower(gridValue)}
                  icon={PlugZap}
                  tone="text-blue-500"
                />
                <FlowNode compact x={610} y={345} label="Home Load" value="0 W" icon={Home} tone="text-emerald-500" />
              </svg>
            </div>

            {/* Bottom 4-column Stats Row - +100% larger text layout */}
            <div className="mt-3 grid grid-cols-4 gap-3 rounded-3xl border border-white/55 bg-white/45 p-3.5 backdrop-blur">
              <div className="rounded-2xl bg-white/35 px-4 py-2.5 flex flex-col justify-center min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] eyebrow-text truncate">Monthly Production</p>
                <p className="data-readout mt-1 text-4xl font-black text-slate-950 truncate leading-none">
                  {metrics.monthlyProductionKwh.toFixed(1)} <span className="text-sm font-bold text-slate-500 ml-0.5">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-4 py-2.5 flex flex-col justify-center min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] eyebrow-text truncate">Monthly Load</p>
                <p className="data-readout mt-1 text-4xl font-black text-slate-950 truncate leading-none">
                  {metrics.monthlyLoadKwh.toFixed(1)} <span className="text-sm font-bold text-slate-500 ml-0.5">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-4 py-2.5 flex flex-col justify-center min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] eyebrow-text truncate">Daily Production</p>
                <p className="data-readout mt-1 text-4xl font-black text-slate-950 truncate leading-none">
                  {formatEnergyToday(metrics.todayProductionKwh)} <span className="text-sm font-bold text-slate-500 ml-0.5">kWh</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/35 px-4 py-2.5 flex flex-col justify-center min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] eyebrow-text truncate">Weather</p>
                <p className="data-readout mt-1 flex items-center gap-1.5 text-4xl font-black text-slate-950 truncate leading-none">
                  {weather && weather.source === "live" ? (
                    <>
                      {createElement(weatherIcon(weather.current.weatherCode, weather.current.isDay), { className: "h-6 w-6 shrink-0 text-amber-400" })}
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
            subtitle="Tapo C545d"
            cameraIp="192.168.1.123"
          />

          <TvCctvPlayer
            src={process.env.NEXT_PUBLIC_CCTV_HLS_URL_2 || ""}
            label="DLC"
            subtitle="Tapo C545d"
            cameraIp="192.168.1.106"
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
