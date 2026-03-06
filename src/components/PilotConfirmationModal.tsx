"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Plane,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSmartTrade } from "@/services/api";
import { useHoldings } from "@/hooks/usePortfolio";
import { AssetIcon } from "./AssetIcon";
import { normalizeSymbol } from "@/lib/symbol-utils";
import type { SmartTradeOrder } from "./ActiveSmartTrades";
import { logger } from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────
interface F4Signal {
  aiScore: number;
  systemDecision: string;
  trend: string;
  currentPrice: number;
  marketRegime: string;
}

interface AssetPilotRow {
  symbol: string; // e.g. "BTC"
  fullSymbol: string; // e.g. "BTCUSDT"
  holding: number;
  holdingValue: number;
  currentPrice: number;
  aiScore: number;
  systemDecision: string;
  trend: string;
  marketRegime: string;
  hasOpenOrder: boolean;
  pilotAction: "TRADE" | "COVER" | "SKIP";
  skipReason?: string;
}

interface PilotConfirmationModalProps {
  isOpen: boolean;
  timeframe: string;
  onClose: () => void;
  existingTrades: SmartTradeOrder[];
  onComplete: () => void;
}

// ─── Decision Engine ─────────────────────────────────────────────
function decidePilotAction(
  aiScore: number,
  systemDecision: string,
  hasOpenOrder: boolean,
): { action: "TRADE" | "COVER" | "SKIP"; reason?: string } {
  if (hasOpenOrder) {
    return { action: "SKIP", reason: "Mevcut açık order var" };
  }
  if (systemDecision === "GO_LONG" && aiScore >= 40) {
    return { action: "TRADE" };
  }
  if (systemDecision === "GO_SHORT" && aiScore < 60) {
    return { action: "COVER" };
  }
  if (aiScore < 40) {
    return { action: "SKIP", reason: "AI skoru düşük (< 40)" };
  }
  return { action: "SKIP", reason: "AI kararsız (WAIT)" };
}

// ─── Component ───────────────────────────────────────────────────
export const PilotConfirmationModal: React.FC<PilotConfirmationModalProps> = ({
  isOpen,
  timeframe,
  onClose,
  existingTrades,
  onComplete,
}) => {
  const { data: holdings } = useHoldings();
  const [rows, setRows] = useState<AssetPilotRow[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<
    { symbol: string; success: boolean; message: string }[]
  >([]);
  const [executionDone, setExecutionDone] = useState(false);

  // ── Build asset rows on open ──
  const buildRows = useCallback(async () => {
    if (!holdings || holdings.length === 0) {
      setIsLoadingSignals(false);
      return;
    }

    setIsLoadingSignals(true);

    // Filter to crypto assets only (exclude USDT/USDC)
    const cryptoHoldings = holdings.filter(
      (h) => h.symbol !== "USDT" && h.symbol !== "USDC",
    );

    // Set of symbols that already have open orders (PENDING or FILLED)
    const openOrderSymbols = new Set(
      existingTrades
        .filter((t) => t.status === "FILLED" || t.status === "PENDING")
        .map((t) => t.symbol.replace("/", "")),
    );

    // Fetch AI signals for all assets in parallel (P4.2 fix)
    const signalPromises = cryptoHoldings.map(async (h) => {
      const fullSymbol = normalizeSymbol(h.symbol);
      let signal: F4Signal = {
        aiScore: 0,
        systemDecision: "WAIT",
        trend: "NEUTRAL",
        currentPrice: h.price || 0,
        marketRegime: "NEUTRAL",
      };

      try {
        const res = await fetch(
          `/api/indicators/f4?symbol=${fullSymbol}&interval=${timeframe}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!data.error) {
            signal = {
              aiScore: data.confluenceScore ?? data.aiScore ?? 0,
              systemDecision: data.systemDecision || "WAIT",
              trend: data.trend || "NEUTRAL",
              currentPrice: data.currentPrice || h.price || 0,
              marketRegime: data.marketRegime || "NEUTRAL",
            };
          }
        }
      } catch {
        // silent — use defaults
      }

      return { holding: h, fullSymbol, signal };
    });

    const results = await Promise.allSettled(signalPromises);

    const assetRows: AssetPilotRow[] = results
      .filter(
        (r): r is PromiseFulfilledResult<{ holding: typeof cryptoHoldings[0]; fullSymbol: string; signal: F4Signal }> =>
          r.status === "fulfilled",
      )
      .map(({ value: { holding: h, fullSymbol, signal } }) => {
        const hasOpenOrder = openOrderSymbols.has(fullSymbol);
        const { action, reason } = decidePilotAction(
          signal.aiScore,
          signal.systemDecision,
          hasOpenOrder,
        );

        return {
          symbol: h.symbol,
          fullSymbol,
          holding: h.holding,
          holdingValue: h.holding * signal.currentPrice,
          currentPrice: signal.currentPrice,
          aiScore: signal.aiScore,
          systemDecision: signal.systemDecision,
          trend: signal.trend,
          marketRegime: signal.marketRegime,
          hasOpenOrder,
          pilotAction: action,
          skipReason: reason,
        };
      });

    setRows(assetRows);
    setIsLoadingSignals(false);
  }, [holdings, existingTrades, timeframe]);

  useEffect(() => {
    if (isOpen) {
      setExecutionDone(false);
      setExecutionLog([]);
      buildRows();
    }
  }, [isOpen, buildRows]);

  // ── Execute trades ──
  const handleConfirm = async () => {
    const actionableRows = rows.filter((r) => r.pilotAction !== "SKIP");
    if (actionableRows.length === 0) {
      onClose();
      return;
    }

    setIsExecuting(true);
    // Get USDT balance for TRADE mode allocation
    const usdtHolding = holdings?.find(
      (h) => h.symbol === "USDT" || h.symbol === "USDC",
    );
    const totalUsdt = usdtHolding?.holding ?? 0;
    const tradeCount = actionableRows.filter(
      (r) => r.pilotAction === "TRADE",
    ).length;
    // Allocate equally among TRADE assets, max 10% of total per asset
    const perAssetUsdt =
      tradeCount > 0
        ? Math.min(totalUsdt / tradeCount, totalUsdt * 0.1)
        : 0;

    // Build trade promises for parallel execution (P4.3 fix)
    const tradePromises = actionableRows.map(async (row) => {
      try {
        if (row.pilotAction === "TRADE") {
          // BUY mode — allocate USDT
          // Guard: ensure currentPrice is positive to prevent Infinity/NaN (P4.1 fix)
          if (row.currentPrice <= 0) {
            return {
              symbol: row.fullSymbol,
              success: false,
              message: "Fiyat verisi alınamadı (0 veya negatif)",
            };
          }
          const amount = perAssetUsdt / row.currentPrice;
          // Minimum order size ~5 USDT
          if (amount <= 0 || perAssetUsdt < 5) {
            return {
              symbol: row.fullSymbol,
              success: false,
              message: "Yetersiz USDT bakiyesi (min $5)",
            };
          }

          await createSmartTrade({
            mode: "TRADE",
            symbol: row.fullSymbol,
            amount: amount.toString(),
            buyPrice: row.currentPrice.toString(),
            buyType: "LIMIT",
            useExisting: false,
            trailingBuy: false,
            takeProfit: {
              type: "LIMIT",
              price: (row.currentPrice * 1.05).toString(), // 5% TP
              trailing: false,
            },
            stopLoss: {
              type: "LIMIT",
              price: (row.currentPrice * 0.97).toString(), // 3% SL
              trailing: false,
              breakeven: false,
              timeout: false,
            },
            timeframe,
          });

          logger.success(
            "✈️ PİLOT TRADE",
            `${row.fullSymbol} için TRADE açıldı. AI Skor: ${row.aiScore}`,
          );
          return {
            symbol: row.fullSymbol,
            success: true,
            message: `TRADE açıldı — $${perAssetUsdt.toFixed(2)} USDT`,
          };
        } else if (row.pilotAction === "COVER") {
          // SELL mode — use existing asset balance
          if (row.holding <= 0) {
            return {
              symbol: row.fullSymbol,
              success: false,
              message: "Yetersiz varlık bakiyesi",
            };
          }
          // Guard: ensure currentPrice is positive (P4.1 fix)
          if (row.currentPrice <= 0) {
            return {
              symbol: row.fullSymbol,
              success: false,
              message: "Fiyat verisi alınamadı (0 veya negatif)",
            };
          }

          await createSmartTrade({
            mode: "COVER",
            symbol: row.fullSymbol,
            amount: row.holding.toString(),
            buyPrice: row.currentPrice.toString(),
            buyType: "LIMIT",
            useExisting: true,
            trailingBuy: false,
            takeProfit: {
              type: "LIMIT",
              price: (row.currentPrice * 0.95).toString(), // Cover TP at -5%
              trailing: false,
            },
            stopLoss: {
              type: "LIMIT",
              price: (row.currentPrice * 1.03).toString(), // Cover SL at +3%
              trailing: false,
              breakeven: false,
              timeout: false,
            },
            timeframe,
          });

          logger.success(
            "✈️ PİLOT COVER",
            `${row.fullSymbol} için COVER açıldı. AI Skor: ${row.aiScore}`,
          );
          return {
            symbol: row.fullSymbol,
            success: true,
            message: `COVER açıldı — ${row.holding.toFixed(4)} adet`,
          };
        }
        return {
          symbol: row.fullSymbol,
          success: false,
          message: "Bilinmeyen aksiyon",
        };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Bilinmeyen hata";
        logger.error(
          "✈️ PİLOT HATA",
          `${row.fullSymbol} işlemi başarısız: ${msg}`,
        );
        return {
          symbol: row.fullSymbol,
          success: false,
          message: msg,
        };
      }
    });

    const tradeResults = await Promise.allSettled(tradePromises);
    const logs = tradeResults.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        symbol: "UNKNOWN",
        success: false,
        message: result.reason?.message || "Promise rejected",
      };
    });

    setExecutionLog(logs);
    setIsExecuting(false);
    setExecutionDone(true);
    onComplete();
  };

  if (!isOpen) return null;

  const actionableCount = rows.filter((r) => r.pilotAction !== "SKIP").length;
  const skipCount = rows.filter((r) => r.pilotAction === "SKIP").length;
  const tradeCount = rows.filter((r) => r.pilotAction === "TRADE").length;
  const coverCount = rows.filter((r) => r.pilotAction === "COVER").length;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isExecuting ? onClose : undefined}
      />

      {/* Modal Panel */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-slate-950 border border-slate-700/50 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-gradient-to-r from-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-md animate-pulse" />
              <Plane className="w-6 h-6 text-cyan-400 relative z-10" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-[0.2em]">
                ✈️ PİLOT MOD — OTOMATİK İŞLEM ONAYI
              </h2>
              <p className="text-[10px] text-slate-500 font-bold tracking-wide mt-0.5">
                Portföyünüzdeki varlıklar AI tarafından analiz edildi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* ── Summary Bar ── */}
        {!isLoadingSignals && !executionDone && (
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-900/60 border-b border-slate-800/40 text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Brain className="w-3 h-3" />
              {rows.length} VARLIK ANALİZ EDİLDİ
            </div>
            {tradeCount > 0 && (
              <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <TrendingUp className="w-3 h-3" />
                {tradeCount} TRADE
              </div>
            )}
            {coverCount > 0 && (
              <div className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                <TrendingDown className="w-3 h-3" />
                {coverCount} COVER
              </div>
            )}
            {skipCount > 0 && (
              <div className="flex items-center gap-1 text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                <Ban className="w-3 h-3" />
                {skipCount} PAS GEÇ
              </div>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoadingSignals ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                AI analiz ediliyor...
              </span>
              <p className="text-[10px] text-slate-600 max-w-[280px] text-center">
                Her varlık için 4S periyodunda yapay zeka sinyalleri toplanıyor
              </p>
            </div>
          ) : executionDone ? (
            /* ── Execution Results ── */
            <div className="p-6 space-y-3">
              <div className="text-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  İşlem Sonuçları
                </h3>
              </div>
              {executionLog.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs font-bold",
                    log.success
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/5 border-rose-500/20 text-rose-400",
                  )}
                >
                  <span className="font-black">
                    {log.symbol.replace("USDT", "")}/USDT
                  </span>
                  <span>{log.message}</span>
                  {log.success ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
              ))}
              <button
                onClick={onClose}
                className="w-full mt-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider transition-colors"
              >
                KAPAT
              </button>
            </div>
          ) : (
            /* ── Asset Grid (Responsive) ── */
            <div className={cn(
              "p-6 grid gap-4",
              rows.length > 8 ? "md:grid-cols-2" : "grid-cols-1"
            )}>
              {rows.map((row) => (
                <div 
                  key={row.fullSymbol}
                  className={cn(
                    "p-3 rounded-xl border transition-all relative overflow-hidden group",
                    row.pilotAction === "SKIP" 
                      ? "bg-slate-900/40 border-slate-800/50 opacity-60" 
                      : "bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/30 hover:bg-slate-900/80"
                  )}
                >
                  {/* Top Row: Icon + Symbol + AI Score */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AssetIcon symbol={row.symbol} size={24} />
                      <div>
                        <div className="text-xs font-black text-white">{row.symbol}/USDT</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          ${row.currentPrice.toLocaleString(undefined, { 
                            maximumFractionDigits: row.currentPrice < 1 ? 6 : 2,
                            minimumFractionDigits: row.currentPrice < 1 ? 4 : 2 
                          })}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black font-mono border",
                      row.aiScore >= 60 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                      row.aiScore >= 40 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                      "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    )}>
                      {row.aiScore}%
                    </div>
                  </div>

                  {/* Middle Row: Trend & Decision */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1 rounded border text-[9px] font-black uppercase",
                      row.trend === "BULLISH" ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-500/70" :
                      row.trend === "BEARISH" ? "bg-rose-500/5 border-rose-500/10 text-rose-500/70" :
                      "bg-slate-800/30 border-slate-700/30 text-slate-600"
                    )}>
                      {row.trend === "BULLISH" ? <TrendingUp className="w-2.5 h-2.5" /> : row.trend === "BEARISH" ? <TrendingDown className="w-2.5 h-2.5" /> : null}
                      {row.trend === "BULLISH" ? "YÜKSELİŞ" : row.trend === "BEARISH" ? "DÜŞÜŞ" : "NÖTR"}
                    </div>
                    <div className={cn(
                      "flex-1 flex items-center justify-center py-1 rounded border text-[9px] font-black uppercase",
                      row.systemDecision === "GO_LONG" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      row.systemDecision === "GO_SHORT" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                      "bg-slate-800 border-slate-700 text-slate-500"
                    )}>
                      {row.systemDecision === "GO_LONG" ? "LONG AÇ" : row.systemDecision === "GO_SHORT" ? "SHORT AÇ" : "BEKLE"}
                    </div>
                  </div>

                  {/* Bottom Row: Balance & Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                    <div className="text-left">
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Bakiye</div>
                      <div className="text-[10px] font-mono text-slate-300">
                        {row.holding.toFixed(2)} (${row.holdingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {row.pilotAction === "TRADE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          <Zap className="w-3 h-3 fill-emerald-500/20" /> TRADE
                        </span>
                      )}
                      {row.pilotAction === "COVER" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-black shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                          <Shield className="w-3 h-3" /> COVER
                        </span>
                      )}
                      {row.pilotAction === "SKIP" && (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700/50 bg-slate-800/50 text-[9px] font-black text-slate-500 uppercase">
                            <Ban className="w-2.5 h-2.5" /> PAS GEÇ
                          </span>
                          {row.skipReason && <span className="text-[8px] text-slate-600 truncate max-w-[120px] mt-0.5">{row.skipReason}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!executionDone && (
          <div className="border-t border-slate-800/60 bg-slate-950">
            {/* WARNING BANNER */}
            <div className="px-6 py-3 bg-rose-500/5 border-b border-rose-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-black text-rose-400 uppercase tracking-wide">
                    ⚠️ Sorumluluk size aittir. Bu bölüm geliştirme
                    aşamasındadır.
                  </p>
                  <p className="text-[9px] text-rose-500/70 mt-0.5">
                    Pilot mod, AI analizine dayalı otomatik işlem açar.
                    Gerçek piyasa koşullarında kayıp riski bulunmaktadır.
                    Onaylamadan önce her varlığın durumunu kontrol edin.
                  </p>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between px-6 py-4">
              <button
                onClick={onClose}
                disabled={isExecuting}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-30"
              >
                İPTAL
              </button>

              <button
                onClick={handleConfirm}
                disabled={isExecuting || actionableCount === 0}
                className={cn(
                  "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  actionableCount > 0
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed",
                )}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    İŞLEM AÇILIYOR...
                  </>
                ) : actionableCount > 0 ? (
                  <>
                    <Plane className="w-4 h-4" />
                    ONAYLA — {actionableCount} İŞLEM AÇ
                  </>
                ) : (
                  "İŞLEM AÇILACAK VARLIK YOK"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
