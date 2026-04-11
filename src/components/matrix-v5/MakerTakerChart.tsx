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
      console.log('✅ Canvas ref exists, creating MatrixChartEngine in OVERLAY mode');
      // Pass TRUE as second argument for overlayMode
      engineRef.current = new MatrixChartEngine("chart-canvas", true);
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
    <div className="absolute inset-0 pointer-events-none z-20">
      <canvas 
          id="chart-canvas" 
          ref={chartCanvasRef} 
          style={{ width: "100%", height: "100%", display: "block" }}
      ></canvas>

      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <p className="text-rose-400 font-mono bg-rose-500/10 px-4 py-1 rounded text-xs border border-rose-500/20">
            [MakerTaker] {errorMsg}
          </p>
        </div>
      )}
    </div>
  );
}
