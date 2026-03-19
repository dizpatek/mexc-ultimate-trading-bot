"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useHoldings } from "@/hooks/usePortfolio";
import { useTrade } from "@/context/TradeContext";
import { core } from "@/services/ApiCore";
import { createSmartTrade, api } from "@/services/api";
import { calculateTradePnl } from "@/lib/trade-utils";

export const useSmartTradeLogic = (props: any = {}) => {
  const { data: holdingsRaw, refetch: refetchHoldings } = useHoldings();
  const holdings = useMemo(() => holdingsRaw || [], [holdingsRaw]);
  
  const tradeContext = useTrade();
  const {
    symbol, setSymbol,
    buyPrice, setBuyPrice,
    tpPrice, setTpPrice,
    slPrice, setSlPrice,
    tpEnabled, setTpEnabled,
    slEnabled, setSlEnabled,
    mode, setMode,
    editingTrade, setEditingTrade,
    amount, setAmount,
    allocationPercent, setAllocationPercent,
    useExisting, setUseExisting,
    isTradeFormOpen, setIsTradeFormOpen,
    trailingBuy, setTrailingBuy,
    trailingBuyDev, setTrailingBuyDev,
    trailingTp, setTrailingTp,
    tpDeviation, setTpDeviation,
    isSplitTp, setIsSplitTp,
    tpTargets, setTpTargets,
    trailingSl, setTrailingSl,
    moveToBreakeven, setMoveToBreakeven,
    slTimeout, setSlTimeout,
    priceSync, setPriceSync,
    marketPrice, setMarketPrice,
    scrollToTrade, consumePendingScroll, pendingScroll,
  } = tradeContext;

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [timeframe, setTimeframe] = useState("4h"); // Default if context missing

  const buyPriceInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<{ focusOnPrices: () => void } | null>(null);
  const lowestSeenRef = useRef<number>(Infinity);
  const highestSeenRef = useRef<number>(-Infinity);
  const lastInitKey = useRef("");
  const lastSwappedModeRef = useRef<string | null>(null);

  // Auto-clear status message
  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // Market Price Sync
  useEffect(() => {
    const formattedSym = symbol.replace("/", "").toUpperCase();
    core.market.setSymbols([formattedSym]);
    const unsubscribe = core.market.subscribe((updates) => {
      const update = updates[formattedSym];
      if (update) {
        const p = parseFloat(update.price);
        if (!isNaN(p) && p > 0) setMarketPrice(p);
      }
    });
    return unsubscribe;
  }, [symbol, setMarketPrice]);

  // Trailing Logic
  const latestPricesRef = useRef({ buyPrice, tpPrice, slPrice, buyP: parseFloat(buyPrice) || 0 });
  useEffect(() => {
    latestPricesRef.current = { buyPrice, tpPrice, slPrice, buyP: parseFloat(buyPrice) || 0 };
  });

  useEffect(() => {
    if (trailingBuy && marketPrice && marketPrice > 0) {
      let trailingSnap: number;
      if (mode === "TRADE") {
        lowestSeenRef.current = Math.min(lowestSeenRef.current, marketPrice);
        trailingSnap = lowestSeenRef.current * (1 + trailingBuyDev / 100);
      } else {
        highestSeenRef.current = Math.max(highestSeenRef.current, marketPrice);
        trailingSnap = highestSeenRef.current * (1 - trailingBuyDev / 100);
      }

      const currentBuyP = latestPricesRef.current.buyP;
      const diff = Math.abs(currentBuyP - trailingSnap);
      if (diff <= (currentBuyP * 0.0001)) return;

      const captureBuy = parseFloat(latestPricesRef.current.buyPrice) || 0;
      const captureTp = parseFloat(latestPricesRef.current.tpPrice) || 0;
      const captureSl = parseFloat(latestPricesRef.current.slPrice) || 0;
      const tpOffset = captureBuy > 0 && captureTp > 0 ? captureTp - captureBuy : null;
      const slOffset = captureBuy > 0 && captureSl > 0 ? captureSl - captureBuy : null;

      setBuyPrice(trailingSnap.toString());
      if (tpOffset !== null && tpOffset !== 0) {
        const v = trailingSnap + tpOffset;
        if (v > 0) setTpPrice(Number(v.toFixed(6)).toString());
      }
      if (slOffset !== null && slOffset !== 0) {
        const v = trailingSnap + slOffset;
        if (v > 0) setSlPrice(Number(v.toFixed(6)).toString());
      }
    }
  }, [trailingBuy, marketPrice, trailingBuyDev, mode, setBuyPrice, setTpPrice, setSlPrice]);

  const handleAssetSelect = useCallback((asset: any) => {
    let newSymbol = asset.symbol === "USDT" ? "BTC/USDT" : asset.symbol;
    if (!newSymbol.includes("/")) {
      newSymbol = newSymbol.endsWith("USDT") ? newSymbol.replace("USDT", "/USDT") : `${newSymbol}/USDT`;
    }
    setSymbol(newSymbol);
    const currentPrice = asset.price;
    setBuyPrice(currentPrice.toString());

    const isCover = mode === "COVER";
    setTpPrice((isCover ? currentPrice * 0.99 : currentPrice * 1.01).toFixed(6));
    setSlPrice((isCover ? currentPrice * 1.01 : currentPrice * 0.99).toFixed(6));
    setAmount("0");
    setAllocationPercent(0);
  }, [setSymbol, setBuyPrice, setTpPrice, setSlPrice, mode, setAmount, setAllocationPercent]);

  const handleSubmit = async () => {
    const submitAmt = parseFloat(amount);
    if (isNaN(submitAmt) || submitAmt <= 0) {
      setStatusMsg({ text: "Hata: Miktar 0 veya geçersiz.", type: "error" });
      return;
    }

    const effectiveBuyPrice = priceSync && !useExisting && marketPrice ? marketPrice.toString() : buyPrice;
    const effectiveBuyP = parseFloat(effectiveBuyPrice);
    if (isNaN(effectiveBuyP) || effectiveBuyP <= 0) {
      setStatusMsg({ text: "Hata: Alış fiyatı geçersiz.", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        mode, symbol, amount, buyPrice: effectiveBuyPrice, buyType: "MARKET",
        useExisting, trailingBuy, trailingBuyDev,
        takeProfit: tpEnabled ? { price: tpPrice, isSplit: isSplitTp, targets: isSplitTp ? tpTargets.map(t => ({ price: t.price, volume: t.volume })) : null, trailing: trailingTp, deviation: trailingTp ? tpDeviation : undefined } : null,
        stopLoss: slEnabled ? { price: slPrice, trailing: trailingSl, breakeven: moveToBreakeven, timeout: slTimeout, timeoutSeconds: slTimeout ? 10 : undefined } : null,
      };

      if (editingTrade) {
        await api.put(`/trade/smart?id=${editingTrade.id}`, payload);
        setStatusMsg({ text: "Değişiklikler başarıyla kaydedildi!", type: "success" });
        setTimeout(() => {
          if (props.onCancelEdit) props.onCancelEdit();
          if (props.onSaveSuccess) props.onSaveSuccess();
        }, 1500);
      } else {
        await createSmartTrade(payload as Record<string, unknown>);
        setStatusMsg({ text: "SmartTrade başarıyla oluşturuldu!", type: "success" });
        setTimeout(() => { if (props.onSaveSuccess) props.onSaveSuccess(); }, 2000);
      }
      refetchHoldings();
    } catch (error) {
      console.error("SmartTrade submission failed:", error);
      setStatusMsg({ text: "Hata: Sunucuya bağlanılamadı.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePricesChange = useCallback((p: { buy?: number; tp?: number; sl?: number }) => {
    if (p.buy !== undefined && p.tp === undefined && p.sl === undefined) {
      const newBuy = p.buy;
      const oldBuy = parseFloat(buyPrice) || 0;
      setBuyPrice(newBuy.toString());
      if (trailingBuy) return;

      if (oldBuy > 0) {
        const curTp = parseFloat(tpPrice) || 0;
        const curSl = parseFloat(slPrice) || 0;
        if (curTp > 0) setTpPrice((newBuy * (curTp / oldBuy)).toFixed(6).toString());
        if (curSl > 0) setSlPrice((newBuy * (curSl / oldBuy)).toFixed(6).toString());
        setTpTargets(prev => prev.map(t => ({ ...t, price: (newBuy * ((parseFloat(t.price) || 0) / oldBuy)).toFixed(6).toString() })));
      }
    } else {
      if (p.buy !== undefined) {
        setBuyPrice(p.buy.toString());
        if (priceSync) setPriceSync(false);
      }
      if (p.tp !== undefined) setTpPrice(p.tp.toString());
      if (p.sl !== undefined) setSlPrice(p.sl.toString());
    }
  }, [buyPrice, tpPrice, slPrice, setBuyPrice, setTpPrice, setSlPrice, setTpTargets, trailingBuy, priceSync, setPriceSync]);

  return {
    ...tradeContext,
    holdings, refetchHoldings,
    isLoading, setIsLoading,
    statusMsg, setStatusMsg,
    buyPriceInputRef, chartRef,
    handleAssetSelect, handleSubmit, handlePricesChange,
    timeframe, setTimeframe,
    displayBuyP: priceSync && !useExisting && marketPrice ? marketPrice : parseFloat(buyPrice) || 0
  };
};
