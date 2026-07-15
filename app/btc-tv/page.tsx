"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const timeframeOptions = [
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
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
  { label: "SPX", symbol: "SP:SPX" },
];

export default function BtcTvPage() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("");
  const [symbol, setSymbol] = useState("BINANCE:BTCUSDT");
  const [interval, setIntervalValue] = useState("D");

  const selectedMarket = marketOptions.find((item) => item.symbol === symbol) ?? marketOptions[0];
  const selectedTimeframe = timeframeOptions.find((item) => item.value === interval) ?? timeframeOptions[2];

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol,
      interval,
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
    [symbol, interval]
  );

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

    return () => {
      target.innerHTML = "";
    };
  }, [widgetConfig]);

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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7931a] text-sm font-black text-white">
              ₿
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

            <div className="min-w-24 text-right font-mono text-lg font-semibold tabular-nums text-emerald-300">{clock}</div>
          </div>
        </header>

        <section className="min-h-0 flex-1">
          <div ref={widgetRef} className="tradingview-widget-container h-full w-full bg-[#0b0d12]" />
        </section>
      </div>
    </main>
  );
}
