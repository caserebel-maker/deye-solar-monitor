"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bitcoin, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

const timeframeOptions = [
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const rangeOptions = [
  { label: "1D", value: "1D" },
  { label: "5D", value: "5D" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "ALL", value: "all" },
];

const marketOptions = [
  { label: "BTCUSDT", symbol: "BINANCE:BTCUSDT" },
  { label: "ETHUSDT", symbol: "BINANCE:ETHUSDT" },
  { label: "BNBUSDT", symbol: "BINANCE:BNBUSDT" },
  { label: "XRPUSDT", symbol: "BINANCE:XRPUSDT" },
  { label: "SOLUSDT", symbol: "BINANCE:SOLUSDT" },
  { label: "DOGEUSDT", symbol: "BINANCE:DOGEUSDT" },
  { label: "TRXUSDT", symbol: "BINANCE:TRXUSDT" },
  { label: "ADAUSDT", symbol: "BINANCE:ADAUSDT" },
  { label: "LINKUSDT", symbol: "BINANCE:LINKUSDT" },
  { label: "AVAXUSDT", symbol: "BINANCE:AVAXUSDT" },
  { label: "XLMUSDT", symbol: "BINANCE:XLMUSDT" },
  { label: "SUIUSDT", symbol: "BINANCE:SUIUSDT" },
  { label: "TONUSDT", symbol: "BINANCE:TONUSDT" },
  { label: "HBARUSDT", symbol: "BINANCE:HBARUSDT" },
  { label: "BCHUSDT", symbol: "BINANCE:BCHUSDT" },
  { label: "LTCUSDT", symbol: "BINANCE:LTCUSDT" },
  { label: "DOTUSDT", symbol: "BINANCE:DOTUSDT" },
  { label: "UNIUSDT", symbol: "BINANCE:UNIUSDT" },
  { label: "AAVEUSDT", symbol: "BINANCE:AAVEUSDT" },
  { label: "NEARUSDT", symbol: "BINANCE:NEARUSDT" },
  { label: "XAUUSD", symbol: "OANDA:XAUUSD" },
  { label: "DXY", symbol: "TVC:DXY" },
  { label: "SPX", symbol: "SP:SPX" },
  { label: "SPCX · SpaceX", symbol: "NASDAQ:SPCX" },
];

export default function BtcTvPage() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("");
  const [symbol, setSymbol] = useState("BINANCE:BTCUSDT");
  const [interval, setIntervalValue] = useState("D");
  const [rangeIndex, setRangeIndex] = useState(3);
  const [draftRangeIndex, setDraftRangeIndex] = useState(3);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const selectedMarket = marketOptions.find((item) => item.symbol === symbol) ?? marketOptions[0];
  const selectedTimeframe = timeframeOptions.find((item) => item.value === interval) ?? timeframeOptions[2];
  const selectedRange = rangeOptions[rangeIndex] ?? rangeOptions[3];

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol,
      interval,
      range: selectedRange.value,
      timezone: "Asia/Bangkok",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      details: true,
      hotlist: false,
      watchlist: marketOptions.map((item) => item.symbol),
      studies: ["STD;RSI"],
      support_host: "https://www.tradingview.com",
    }),
    [symbol, interval, selectedRange.value]
  );

  const refreshChart = () => {
    setRefreshNonce((value) => value + 1);
  };

  const moveRange = (direction: -1 | 1) => {
    setDraftRangeIndex((value) => Math.min(rangeOptions.length - 1, Math.max(0, value + direction)));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRangeIndex(draftRangeIndex);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draftRangeIndex]);

  useEffect(() => {
    const target = widgetRef.current;
    if (!target) return;

    target.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    target.appendChild(widget);
    target.appendChild(script);

    const retryTimer = window.setTimeout(() => {
      if (!target.querySelector("iframe")) {
        setRefreshNonce((value) => value + 1);
      }
    }, 30000);

    return () => {
      window.clearTimeout(retryTimer);
      target.innerHTML = "";
    };
  }, [widgetConfig, refreshNonce]);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 6 * 60 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0b0d12] text-white">
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#111318] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-300/60 bg-[#17202c] text-orange-300 shadow-[0_0_16px_rgba(247,147,26,0.28)]"
              aria-label="Bitcoin"
              title="Bitcoin"
            >
              <Bitcoin size={19} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-wide text-white">
                {selectedMarket.label} · {selectedTimeframe.label}
              </h1>
              <p className="truncate text-[11px] text-white/50">{selectedMarket.symbol} · TradingView Advanced Chart · RSI</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="sr-only" htmlFor="btc-tv-symbol">Symbol</label>
            <select
              id="btc-tv-symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              className="h-9 min-w-36 rounded-lg border border-white/15 bg-[#1a1d24] px-3 text-xs font-semibold text-white outline-none focus:border-emerald-400"
            >
              {marketOptions.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="btc-tv-timeframe">Timeframe</label>
            <select
              id="btc-tv-timeframe"
              value={interval}
              onChange={(event) => setIntervalValue(event.target.value)}
              className="h-9 rounded-lg border border-white/15 bg-[#1a1d24] px-3 text-xs font-semibold text-white outline-none focus:border-emerald-400"
            >
              {timeframeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={refreshChart}
              aria-label="Reload chart"
              title="Reload chart"
              className="flex h-9 items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-400/10 px-3 text-xs font-bold uppercase tracking-wide text-emerald-200 outline-none transition hover:bg-emerald-400/20 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300/60"
            >
              <RotateCw size={15} aria-hidden="true" />
              Reload
            </button>

            <div className="min-w-24 text-right font-mono text-lg font-semibold tabular-nums text-emerald-300">{clock}</div>
          </div>
        </header>

        <nav
          aria-label="Chart range controls"
          className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0f1218] px-4 py-2"
        >
          <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55 sm:block">
            Graph range
          </span>

          <button
            type="button"
            onClick={() => moveRange(-1)}
            disabled={draftRangeIndex === 0}
            aria-label="Show a narrower chart range"
            title="Narrower range"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-[#1a1d24] text-white outline-none transition hover:bg-white/10 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft size={21} aria-hidden="true" />
          </button>

          <input
            aria-label={`Chart range: ${rangeOptions[draftRangeIndex]?.label ?? selectedRange.label}`}
            type="range"
            min="0"
            max={String(rangeOptions.length - 1)}
            step="1"
            value={draftRangeIndex}
            onChange={(event) => setDraftRangeIndex(Number(event.target.value))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
          />

          <button
            type="button"
            onClick={() => moveRange(1)}
            disabled={draftRangeIndex === rangeOptions.length - 1}
            aria-label="Show a wider chart range"
            title="Wider range"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-[#1a1d24] text-white outline-none transition hover:bg-white/10 focus:border-emerald-200 focus:ring-2 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight size={21} aria-hidden="true" />
          </button>

          <div className="min-w-14 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-center text-xs font-bold tabular-nums text-emerald-200">
            {rangeOptions[draftRangeIndex]?.label ?? selectedRange.label}
          </div>

          <div className="hidden shrink-0 text-[11px] text-white/40 lg:block">
            Left / right on slider
          </div>
        </nav>

        <section className="min-h-0 flex-1">
          <div ref={widgetRef} className="tradingview-widget-container h-full w-full bg-[#0b0d12]" />
        </section>
      </div>
    </main>
  );
}
