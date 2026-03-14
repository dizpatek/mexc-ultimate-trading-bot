"use client";

import React, { useState, useEffect } from "react";
import { SmartTrade } from "./SmartTrade";
import { ActiveSmartTrades, SmartTradeOrder } from "./ActiveSmartTrades";
import { debugLog } from "@/services/api";
import { useTrade } from "@/context/TradeContext";

export const SmartOperationCenter = () => {
  const [isClient, setIsClient] = useState(false);
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
    editingTrade,
    setEditingTrade,
    amount,
    setAmount,
    allocationPercent,
    setAllocationPercent,
    useExisting,
    setUseExisting,
    mode,
    setMode,
    setIsTradeFormOpen,
    scrollToTrade,
  } = useTrade();

  useEffect(() => {
    // Use timeout to avoid synchronous cascading render lint error
    const timer = setTimeout(() => setIsClient(true), 0);
    debugLog("info", "SmartOperationCenter Mounted");
    return () => clearTimeout(timer);
  }, []);

  const terminalRef = React.useRef<HTMLDivElement>(null);
  const activeTradesRef = React.useRef<HTMLDivElement>(null);

  const handleSaveSuccess = () => {
    setEditingTrade(null);
    setIsTradeFormOpen(false);
    // Scroll to active trades section so user can see their new/updated trade
    activeTradesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCancelEdit = () => {
    setEditingTrade(null);
    setIsTradeFormOpen(false);
  };

  const handleNew = () => {
    setEditingTrade(null);
    setMode("TRADE");
    setIsTradeFormOpen(true);
    setTimeout(() => {
      scrollToTrade("TOP");
    }, 200);
  };

  const handleEdit = (trade: SmartTradeOrder) => {
    const p = trade.meta.payload;
    setEditingTrade(trade);
    setSymbol(trade.symbol);
    setBuyPrice(p.buyPrice?.toString() || "0");
    setTpPrice(p.takeProfit?.price?.toString() || "0");
    setSlPrice(p.stopLoss?.price?.toString() || "0");
    setTpEnabled(!!p.takeProfit);
    setSlEnabled(!!p.stopLoss);
    setMode(trade.meta.mode as "TRADE" | "COVER");
    setIsTradeFormOpen(true);
    setTimeout(() => {
      scrollToTrade("TOP");
    }, 200);
  };

  if (!isClient) {
    return (
      <div className="w-full h-[900px] bg-slate-950/20 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-black text-cyan-500 uppercase tracking-widest">
          Başlatılıyor...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Unified Terminal Module (Chart + Trade) - Chart is always visible, controls are collapsible */}
      <div
        ref={terminalRef}
        className="animate-in fade-in slide-in-from-top-4 duration-500"
      >
        <SmartTrade
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
          editingTrade={editingTrade ?? undefined}
          onCancelEdit={handleCancelEdit}
          onSaveSuccess={handleSaveSuccess}
        />
      </div>

      <div ref={activeTradesRef}>
        <ActiveSmartTrades onEdit={handleEdit} onNewTrade={handleNew} />
      </div>
    </div>
  );
};
