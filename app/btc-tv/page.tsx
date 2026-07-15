"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const symbols = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "OANDA:XAUUSD",
  "TVC:DXY",
  "CRYPTOCAP:TOTAL",
  "CRYPTOCAP:TOTAL2",
  "CRYPTOCAP:TOTAL3",
];

export default function BtcTvPage() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("");

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval: "D",
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
      watchlist: symbols,
      studies: ["STD;RSI"],
      support_host: "https://www.tradingview.com",
    }),
    []
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
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#111318] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7931a] text-sm font-black text-white">
              ₿
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-wide text-white">BTCUSDT · Daily Chart</h1>
              <p className="truncate text-[11px] text-white/50">BINANCE · TradingView Advanced Chart · RSI</p>
            </div>
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-emerald-300">{clock}</div>
        </header>

        <section className="min-h-0 flex-1">
          <div ref={widgetRef} className="tradingview-widget-container h-full w-full bg-[#0b0d12]" />
        </section>
      </div>
    </main>
  );
}
