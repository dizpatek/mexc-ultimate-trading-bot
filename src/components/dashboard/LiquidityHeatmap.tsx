"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderLevel {
  price: number;
  quantity: number;
  side: "bid" | "ask";
}

interface ArbInfo {
  gapPercent: number;
  fasterExchange: string;
  isArbitrage: boolean;
  hlPrice: number | null;
  mexcPrice: number | null;
}

export const LiquidityHeatmap = React.memo(({ symbol }: { symbol: string }) => {
  const [levels, setLevels] = useState<OrderLevel[]>([]);
  const [arbInfo, setArbInfo] = useState<ArbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [midPrice, setMidPrice] = useState<number>(0);

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      try {
        const [obResp, arbResp] = await Promise.allSettled([
          fetch(`/api/orderbook?symbol=${symbol}&limit=20`).then(r => r.ok ? r.json() : null),
          fetch(`/api/arb?symbol=${symbol}`).then(r => r.ok ? r.json() : null)
        ]);

        if (!isActive) return;

        if (obResp.status === "fulfilled" && obResp.value) {
          const ob = obResp.value;
          const bids: OrderLevel[] = (ob.bids || []).slice(0, 10).map((b: any) => ({
            price: parseFloat(b[0] || b.price || 0),
            quantity: parseFloat(b[1] || b.quantity || 0),
            side: "bid" as const
          }));
          const asks: OrderLevel[] = (ob.asks || []).slice(0, 10).map((a: any) => ({
            price: parseFloat(a[0] || a.price || 0),
            quantity: parseFloat(a[1] || a.quantity || 0),
            side: "ask" as const
          }));
          
          const allLevels = [...bids.reverse(), ...asks];
          setLevels(allLevels);
          
          if (bids.length > 0 && asks.length > 0) {
            setMidPrice((bids[bids.length - 1].price + asks[0].price) / 2);
          }
        }

        if (arbResp.status === "fulfilled" && arbResp.value) {
          setArbInfo(arbResp.value as ArbInfo);
        }
      } catch (err) {
        console.warn("[Heatmap]", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => { isActive = false; clearInterval(interval); };
  }, [symbol]);

  // Hacim bazlı renk hesaplayıcı
  const maxQty = useMemo(() => {
    if (levels.length === 0) return 1;
    return Math.max(...levels.map(l => l.quantity));
  }, [levels]);

  const getHeatColor = (qty: number, side: "bid" | "ask") => {
    const intensity = Math.min(qty / maxQty, 1);
    if (side === "bid") {
      const alpha = 0.1 + intensity * 0.6;
      return `rgba(16, 185, 129, ${alpha})`;
    } else {
      const alpha = 0.1 + intensity * 0.6;
      return `rgba(244, 63, 94, ${alpha})`;
    }
  };

  const isWall = (qty: number) => qty / maxQty > 0.6;

  return (
    <div className="w-full card-glow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/40 flex justify-between items-center">
        <h3 className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Liquidity Heatmap
        </h3>
        <span className="text-[8px] text-slate-600 font-mono tracking-wider">±10 LEVELS</span>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-[9px] text-slate-600 font-mono">Scanning orderbook...</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col px-2 py-2 gap-0.5">
          {/* Heatmap Levels */}
          {levels.map((level, i) => {
            const barWidth = Math.max((level.quantity / maxQty) * 100, 3);
            const isMid = i === Math.floor(levels.length / 2);
            const wall = isWall(level.quantity);

            return (
              <React.Fragment key={`${level.price}-${i}`}>
                {isMid && (
                  <div className="flex items-center gap-1 py-1 my-0.5">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                    <span className="text-[8px] font-mono text-cyan-400 font-bold px-1 glow-cyan">
                      MID ${midPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: level.side === "bid" ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`relative flex items-center justify-between px-2 py-0.5 rounded-sm group ${wall ? "ring-1 ring-inset" : ""} ${
                    wall && level.side === "bid" ? "ring-emerald-500/30" : wall ? "ring-rose-500/30" : ""
                  }`}
                >
                  {/* Heatmap Bar Background */}
                  <div
                    className={`absolute inset-y-0 rounded-sm transition-all duration-500 ${
                      level.side === "bid" ? "left-0" : "right-0"
                    }`}
                    style={{
                      width: `${barWidth}%`,
                      background: getHeatColor(level.quantity, level.side),
                    }}
                  />
                  
                  <span className={`relative text-[9px] font-mono z-10 ${
                    level.side === "bid" ? "text-emerald-300" : "text-rose-300"
                  }`}>
                    ${level.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </span>
                  <span className={`relative text-[8px] font-mono z-10 ${
                    wall ? (level.side === "bid" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold") : "text-slate-500"
                  }`}>
                    {level.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {wall && <span className="ml-1 text-amber-400">🧱</span>}
                  </span>
                </motion.div>
              </React.Fragment>
            );
          })}

          {levels.length === 0 && (
            <div className="py-6 text-center text-[10px] text-slate-600 font-mono">No orderbook data</div>
          )}
        </div>
      )}

      {/* Arbitrage Section */}
      {arbInfo && (
        <div className="px-3 py-2 border-t border-slate-800/40">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <div className="text-center">
              <div className="text-slate-600 text-[7px] tracking-wider">HYPERLIQUID</div>
              <div className="text-slate-300 font-bold">${arbInfo.hlPrice?.toFixed(2) ?? "—"}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-600 text-[7px] tracking-wider">SPREAD</div>
              <div className={`font-black text-sm ${
                arbInfo.isArbitrage ? "text-amber-400 glow-amber animate-pulse" : "text-slate-500"
              }`}>
                {arbInfo.gapPercent.toFixed(3)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-600 text-[7px] tracking-wider">MEXC</div>
              <div className="text-slate-300 font-bold">${arbInfo.mexcPrice?.toFixed(2) ?? "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Arbitrage Alert */}
      <AnimatePresence>
        {arbInfo?.isArbitrage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-2 mb-2 p-2 bg-amber-500/5 border border-amber-500/30 rounded-lg flex justify-between items-center"
          >
            <span className="text-[9px] font-black text-amber-400 glow-amber flex items-center gap-1">
              <span className="animate-pulse">⚡</span> SİNYAL DOĞRULANDI
            </span>
            <span className="text-[8px] font-mono text-amber-300">
              {arbInfo.fasterExchange} → MEXC | %{arbInfo.gapPercent.toFixed(3)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

LiquidityHeatmap.displayName = "LiquidityHeatmap";
