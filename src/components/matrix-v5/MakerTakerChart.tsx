"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { DataService } from "./core/data";
import { MatrixChartEngine } from "./core/matrixChartEngine";

import "./MakerTakerChart.css";

export function MultiExchangeFlowChart({ symbol: initialSymbol = "BTC-USDT" }: { symbol?: string }) {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [symbol, setSymbol] = useState(initialSymbol);
  const [duration, setDuration] = useState(300);
  const [exchange, setExchange] = useState("ALL");
  const [exchanges, setExchanges] = useState<string[]>(["ALL"]);
  const [aggregated, setAggregated] = useState(true);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Initialize DataService directly (not in effect) to avoid setState in effect
  const initialDs = new DataService();
  const dataServiceRef = useRef<DataService>(initialDs);
  const engineRef = useRef<MatrixChartEngine | null>(null);
  const liveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [noTrades, setNoTrades] = useState(true);
  const loadingStartRef = useRef<number>(0);

  const noTradesRef = useRef(noTrades);
  // Sync ref with state in an effect
  useEffect(() => {
    noTradesRef.current = noTrades;
  }, [noTrades]);

  // Global WebSocket callback handler
  useEffect(() => {
      const handleLiveTrade = () => {
          const ds = dataServiceRef.current;
          const engine = engineRef.current;
          if (!ds || !engine || ds.isBulkLoading) return;
          
          if (engine.viewport.isLive && engine.trades.length !== ds.list.length) {
              engine.trades = [...ds.list];
              engine.invalidateCache();
              engine.needsRender = true;
          }
      };
      
      const g = window as unknown as { onLiveTradeReceived: (() => void) | null };
      g.onLiveTradeReceived = handleLiveTrade;
      return () => {
         g.onLiveTradeReceived = null;
      };
  }, []);

  useEffect(() => {
    console.log('🔧 MakerTakerChart useEffect - Creating engine...');
    if (chartCanvasRef.current) {
      console.log('✅ Canvas ref exists, creating MatrixChartEngine');
      engineRef.current = new MatrixChartEngine("chart-canvas");
      console.log('✅ Engine created:', engineRef.current);
    } else {
      console.log('❌ Canvas ref is null!');
    }

    // Statik borsa listesi (Eski fetch yerine)
    const availableExchanges = [
      "BINANCE_PERP", "BINANCE_SPOT", "BYBIT_PERP", "BYBIT_SPOT",
      "OKX_PERP", "OKX_SPOT", "COINBASE_SPOT", "KRAKEN_SPOT",
      "KUCOIN_PERP", "KUCOIN_SPOT", "GATE_PERP", "GATE_SPOT",
      "BITGET_PERP", "BITGET_SPOT", "MEXC_PERP", "MEXC_SPOT",
      "HUOBI_PERP", "HUOBI_SPOT"
    ];
    setExchanges(availableExchanges);

    // Fast render loop - uses refs so always reads latest values
    loopIntervalRef.current = setInterval(() => {
      if (!dataServiceRef.current || !engineRef.current) return;
      const dsCurrent = dataServiceRef.current;
      const engine = engineRef.current;

      // UI state Sync
      if (dsCurrent.state === 0) {
        // Başlangıç zamanını kaydet
        if (loadingStartRef.current === 0) loadingStartRef.current = Date.now();

        if (dsCurrent.list.length === 0) {
          setLoading(true);
          setBackgroundLoading(false);
        } else {
          setLoading(true);
          setBackgroundLoading(true);
        }
        setErrorMsg("");

        // 20sn geçti ve hâlâ yüklüyorsa loading'i kapat (takılı kalmayı engelle)
        if (Date.now() - loadingStartRef.current > 20000) {
          loadingStartRef.current = 0;
          dsCurrent.state = 2; // Manuel tamamlandı say
          setLoading(false);
          if (dsCurrent.list.length === 0) {
            setErrorMsg("Veri bulunamadı (API timeout). Lütfen tekrar deneyin.");
          }
        }
      } else if (dsCurrent.state === 1) {
        loadingStartRef.current = 0;
        setErrorMsg(dsCurrent.error);
        setLoading(false);
      } else {
        loadingStartRef.current = 0;
        setLoading(false);
        setErrorMsg("");

        // Render chart data changes
        if (
          engine.trades.length !== dsCurrent.list.length ||
          engine.aggregated !== dsCurrent.aggregated
        ) {
          engine.setData(dsCurrent);
        }

        // Check lazy loading (only if not in bulk sequential fetch)
        if (engine.onPanLazyLoad && !dsCurrent.isBulkLoading) {
          engine.onPanLazyLoad(
            engine.viewport.startTime,
            engine.viewport.endTime,
          );
        }

        // Update noTrades state for overlay
        if (dsCurrent.list.length > 0 && noTradesRef.current) {
          setNoTrades(false);
        }
        if (dsCurrent.list.length === 0 && !noTradesRef.current) {
          setNoTrades(true);
        }
      }
    }, 30);

    // Global keyboard listener for hotkeys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") {
        if (!dataServiceRef.current || !engineRef.current) return;
        const dsCurrent = dataServiceRef.current;
        dsCurrent.toggleAggregation();
        setAggregated(dsCurrent.aggregated);
        engineRef.current.setData(dsCurrent);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleAggregation() {
    if (!dataServiceRef.current || !engineRef.current) return;
    const ds = dataServiceRef.current;
    ds.toggleAggregation();
    setAggregated(ds.aggregated);
    engineRef.current.setData(ds);
  }

  const generate = useCallback(async () => {
    if (!dataServiceRef.current || !engineRef.current) return;
    const ds = dataServiceRef.current;
    const engine = engineRef.current;

    ds.reset();
    engine.trades = [];
    engine.viewport.endTime = 0;
    
    // Reset viewport tracking
    engine.viewport.startTime = 0;
    
    // Reset DataService
    const newDs = new DataService();
    newDs.threshold = ds.threshold;
    dataServiceRef.current = newDs;
    
    const activeDs = newDs;

    const now = Date.now();
    const startTime = now - duration * 1000;
    const endTime = now;

    engine.viewport.startTime = startTime;
    engine.viewport.endTime = endTime;
    engine.viewport.isLive = true;
    engine.invalidateCache();

    await activeDs.loadRange(symbol, exchange, startTime, endTime);

    if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);

    const livePoll = async () => {
      if (engine.viewport.isLive && !activeDs.isBulkLoading) {
        // Kullanıcının "kapalıyken yapmamalı" isteği için:
        // Sekme arka plandaysa veya bileşen gizliyse sync işlemini atla
        const isVisible = !document.hidden && chartCanvasRef.current && chartCanvasRef.current.offsetHeight > 0;
        
        if (isVisible) {
          const fetchFrom = Math.max(0, activeDs.endTime - 10000);
          await activeDs.loadRange(symbol, exchange, fetchFrom, Date.now());
        }
      }
      // Kullanıcının "saniyede 1 kere senkronizasyon yapmalı" isteği:
      liveTimeoutRef.current = setTimeout(livePoll, 1000);
    };

    livePoll();

    engine.onPanLazyLoad = (vStart: number, vEnd: number) => {
      if (activeDs.state === 0) return; // fetching
      if (vStart < activeDs.startTime) {
        const fetchStart = Math.max(0, vStart - (vEnd - vStart) * 0.5);
        if (fetchStart < activeDs.startTime) {
          activeDs.loadRange(symbol, exchange, fetchStart, activeDs.startTime);
        }
      }
      if (vEnd > activeDs.endTime) {
        const tNow = Date.now();
        if (activeDs.endTime >= tNow - 1000) return;
        const fetchEnd = Math.min(tNow, vEnd + (vEnd - vStart) * 0.5);
        if (fetchEnd > activeDs.endTime) {
          activeDs.loadRange(symbol, exchange, activeDs.endTime, fetchEnd);
        }
      }
    };
  }, [duration, symbol, exchange]);

  // Auto-start on mount or symbol change
  useEffect(() => {
    const t = setTimeout(() => {
      generate();
    }, 100);
    return () => clearTimeout(t);
  }, [generate]);

  const handleTimeframeClick = (sec: number) => {
    setDuration(sec);
    // Needs slight timeout to ensure state update before generate
    setTimeout(() => generate(), 0);
  };

  return (
    <div className="makertakerchart-wrapper w-full h-[600px] flex flex-col relative rounded-xl overflow-hidden shadow-2xl">
      <div id="chart-container" style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Native Chart - Full Width */}
        <div style={{ flex: 1, position: "relative" }}>
          <canvas 
              id="chart-canvas" 
              ref={chartCanvasRef} 
              style={{ 
                  width: "100%",
                  height: "100%",
                  display: "block"
              }}
          ></canvas>
        </div>
      </div>

      {/* UI Toolbar - Bottom */}
      <div id="ui-controls" className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-t border-slate-800">
        <div className="control-group flex items-center gap-2">
          <span className="control-label text-xs text-slate-400 font-bold uppercase tracking-widest">Symbol</span>
          <input
            type="text"
            id="symbol-input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            spellCheck="false"
            className="w-24 bg-slate-800 text-white border border-slate-700 rounded px-2 py-1 text-sm font-mono"
          />
        </div>

        <div className="control-group flex items-center gap-2">
          <span className="control-label text-xs text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Duration</span>
          <input
            type="range"
            id="duration-slider"
            min="1"
            max="3600"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-24 Accent-cyan-500"
          />
          <span
            id="duration-val"
            style={{
              minWidth: "45px",
              textAlign: "right",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {duration >= 3600
              ? duration / 3600 + "h"
              : duration >= 60
                ? duration / 60 + "m"
                : duration + "s"}
          </span>
        </div>

        <div className="timeframe-presets flex items-center gap-1.5 ml-2">
          {[60, 300, 900, 1800, 3600].map((sec) => (
            <button
              key={sec}
              className={`px-2 py-1 text-xs font-bold font-mono rounded transition-colors ${duration === sec ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              onClick={() => handleTimeframeClick(sec)}
            >
              {sec >= 3600
                ? sec / 3600 + "h"
                : sec >= 60
                  ? sec / 60 + "m"
                  : sec + "s"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-4 bg-slate-800 p-0.5 rounded border border-slate-700">
          {[
            { id: "ALL", label: "GLOBAL" },
            { id: "ALL_SPOT", label: "SPOT" },
            { id: "ALL_PERP", label: "PERP" }
          ].map(opt => (
            <button
              key={opt.id}
              className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded transition-colors ${exchange === opt.id ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}
              onClick={() => setExchange(opt.id) }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          id="aggregate-btn"
          className={`ml-auto px-3 py-1 rounded text-xs font-black uppercase tracking-widest transition-colors border ${aggregated ? "bg-amber-500/20 text-amber-500 border-amber-500/50" : "bg-slate-800 text-slate-500 border-slate-700"}`}
          title="Press 'A' to toggle"
          onClick={toggleAggregation}
        >
          Hacim Birleştir
        </button>
        <button id="now-btn" className="px-3 py-1 bg-cyan-500 text-slate-950 text-xs font-black uppercase tracking-widest rounded hover:bg-cyan-400 transition-colors" onClick={generate}>
          LIVE / NOW
        </button>
      </div>

      {/* Version Indicator - Always Visible */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(255, 0, 0, 0.9)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '5px',
        fontWeight: '900',
        fontSize: '12px',
        letterSpacing: '0.1em',
        zIndex: 10
      }}>
        MATRIX V5 LOADED ✓
      </div>

      {/* Overlays */}
      {!loading &&
        !errorMsg &&
        noTrades && (
          <div
            id="welcome-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20 text-center"
          >
            <h2 className="text-2xl font-black text-cyan-400 mb-2 font-mono tracking-tighter">MakerTakerCharts V5 Pro</h2>
            <p className="text-slate-400 font-mono text-sm">
              Professional Grade Historical Trade Visualization.<br/>
              <span className="text-emerald-400 animate-pulse mt-1 inline-block">Connecting to live data stream...</span>
            </p>
          </div>
        )}

      {loading && (
        <div
          id="loading-indicator"
          className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 backdrop-blur-md"
        >
          <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-cyan-400 animate-spin"></div>
          <span className="text-slate-400 font-mono text-[10px] font-black uppercase tracking-widest">Senkronize ediliyor...</span>
        </div>
      )}

      {errorMsg && (
        <div id="error-overlay" className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md z-30">
          <h2 className="text-2xl font-black text-rose-500 mb-2 uppercase tracking-widest">Error Occurred</h2>
          <p id="error-msg" className="text-rose-400 font-mono bg-rose-500/10 px-4 py-2 rounded border border-rose-500/20">
            {errorMsg}
          </p>
        </div>
      )}
    </div>
  );
}
