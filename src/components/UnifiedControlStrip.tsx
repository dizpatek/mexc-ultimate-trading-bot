"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { Wallet, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useHoldings, usePortfolioSummary } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";
import { SmartTrade } from "./SmartTrade";
import { useTrade } from "@/context/TradeContext";

interface UnifiedControlStripProps {
  activeSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  onAssetDataUpdate: (data: { holding: number; usdt: number }) => void;
  symbols?: { proName: string; title: string }[];
}

const TickerTape = ({
  symbols,
}: {
  symbols: { proName: string; title: string }[];
}) => {
  const config = useMemo(
    () => ({
      symbols:
        symbols.length > 0
          ? symbols
          : [
              { proName: "MEXC:BTCUSDT", title: "BTC/USDT" },
              { proName: "MEXC:ETHUSDT", title: "ETH/USDT" },
            ],
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "regular",
      locale: "en",
    }),
    [symbols],
  );

  const encodedConfig = encodeURIComponent(JSON.stringify(config));

  return (
    <div className="w-full h-[32px] border-b border-white/5 bg-slate-950/80 overflow-hidden relative group">
      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <iframe
          src={`https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#${encodedConfig}`}
          style={{
            width: "100%",
            height: "44px",
            border: "none",
            transform: "scale(0.95)",
            transformOrigin: "center",
            pointerEvents: "auto",
          }}
          title="Ticker Tape"
        />
      </div>
    </div>
  );
};

export const UnifiedControlStrip = ({
  activeSymbol,
  onSymbolSelect,
  onAssetDataUpdate,
  symbols = [],
}: UnifiedControlStripProps) => {
  const { data: holdings } = useHoldings();
  const { data: summaryData } = usePortfolioSummary();
  const {
    symbol,
    setSymbol,
    buyPrice,
    setBuyPrice,
    tpPrice,
    setTpPrice,
    slPrice,
    setSlPrice,
    tpEnabled,
    setTpEnabled,
    slEnabled,
    setSlEnabled,
    mode,
    setMode,
    amount,
    setAmount,
    allocationPercent,
    setAllocationPercent,
    useExisting,
    setUseExisting,
    tradeAnchorRef,
    isPanelOpen: isOpen,
    setIsPanelOpen: setIsOpen,
  } = useTrade();

  // USER requested no auto-scroll when panel opens
  /*
    useEffect(() => {
        if (isOpen && pendingScroll) {
            consumePendingScroll();
        }
    }, [isOpen, pendingScroll, consumePendingScroll]);
    */

  // Guard against infinite loop: only notify parent when symbol actually changes
  const prevSymbolRef = useRef<string>(symbol);
  useEffect(() => {
    if (symbol && symbol !== prevSymbolRef.current) {
      prevSymbolRef.current = symbol;
      onSymbolSelect(symbol.replace("/", ""));
    }
  }, [symbol, onSymbolSelect]);

  // Simple derivation — no useMemo needed for lightweight string op
  const assetBase = activeSymbol.replace("USDT", "");

  // Stable callback ref to prevent unnecessary effect re-runs
  const onAssetDataUpdateRef = useRef(onAssetDataUpdate);
  useEffect(() => {
    onAssetDataUpdateRef.current = onAssetDataUpdate;
  }, [onAssetDataUpdate]);

  useEffect(() => {
    if (holdings) {
      const asset = holdings.find((h) => h.symbol === assetBase);
      const usdtAccount = holdings.find(
        (h) => h.symbol === "USDT" || h.symbol === "USDC",
      );
      onAssetDataUpdateRef.current({
        holding: asset?.holding || 0,
        usdt: usdtAccount?.holding || 0,
      });
    }
  }, [holdings, assetBase]);

  return (
    <>
      {/* Toggle Button for Tablet/Mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[60] p-4 rounded-2xl bg-cyan-500 text-black shadow-[0_0_30px_rgba(6,182,212,0.4)] flex lg:hidden items-center justify-center transition-transform active:scale-95"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Desktop Spacer to push main content */}
      <div
        className={cn(
          "hidden lg:block transition-all duration-500 ease-in-out shrink-0",
          isOpen ? "w-[380px]" : "w-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 transition-all duration-500 ease-in-out",
          "w-[380px] max-w-[90vw] h-screen bg-[#020617]/95 backdrop-blur-3xl border-l border-white/5 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Sidebar Glow Decoration */}
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />

        {/* 1. TICKER TAPE INTEGRATION */}
        <TickerTape symbols={symbols} />

        <div className="flex-1 overflow-y-auto no-scrollbar py-1 flex flex-col gap-1">
          {/* 1. PORTFOLIO SUMMARY - MINI */}
          <div className="px-5 py-0.5 flex flex-col relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Wallet className="w-2.5 h-2.5 text-cyan-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                  Portföy
                </span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-black font-mono px-1 rounded bg-slate-950 border border-white/5",
                  (summaryData?.change24h || 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400",
                )}
              >
                {(summaryData?.changePercentage || 0) >= 0 ? "+" : ""}
                {summaryData?.changePercentage.toFixed(2)}%
              </span>
            </div>
            <span className="text-xl font-black text-white font-mono tracking-tighter leading-none">
              ${summaryData?.totalValue?.toLocaleString() || "---"}
            </span>
          </div>

          {/* Items moved to Giga Komuta Kokpiti */}

          {/* COMPACT SMART TRADE PANEL */}
          <div
            id="trade-top-anchor"
            ref={(el) => {
              tradeAnchorRef.current = el;
            }}
            className="px-2 pt-1 pb-8 flex flex-col gap-2"
          >
            <SmartTrade
              compact={true}
              controlledSymbol={symbol}
              onSymbolChange={setSymbol}
              controlledBuyPrice={buyPrice}
              onBuyPriceChange={setBuyPrice}
              controlledTpPrice={tpPrice}
              onTpPriceChange={setTpPrice}
              controlledSlPrice={slPrice}
              onSlPriceChange={setSlPrice}
              controlledTpEnabled={tpEnabled}
              onTpEnabledChange={setTpEnabled}
              controlledSlEnabled={slEnabled}
              onSlEnabledChange={setSlEnabled}
              controlledMode={mode}
              onModeChange={setMode}
              controlledAmount={amount}
              onAmountChange={setAmount}
              controlledAllocationPercent={allocationPercent}
              onAllocationPercentChange={setAllocationPercent}
              controlledUseExisting={useExisting}
              onUseExistingChange={setUseExisting}
            />
          </div>
        </div>
      </aside>

      {/* Float Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 w-8 h-20 bg-slate-950 border border-r-0 border-white/10 rounded-l-xl flex flex-col items-center justify-center gap-1 transition-all duration-500 hover:bg-slate-900 group shadow-2xl z-[61]",
          isOpen ? "right-[380px]" : "right-0",
        )}
      >
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full bg-cyan-500 transition-all shadow-[0_0_8px_rgba(6,182,212,0.6)] flex-shrink-0",
            isOpen && "scale-125",
          )}
        />
        {isOpen ? (
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white flex-shrink-0" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-white flex-shrink-0" />
        )}
        <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-cyan-400 transition-colors whitespace-nowrap">
          SMART
        </span>
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in transition-all"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
