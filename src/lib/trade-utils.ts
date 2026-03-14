export interface SmartTradeOrder {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  currentPrice?: number;
  qty: number;
  status: string;
  created_at: number;
  meta: {
    mode: string;
    lastAiScore?: number | string;
    smartTrade?: boolean;
    dca?: boolean;
    monitorError?: string;
    exitPrice?: number | string;
    exitResult?: { price: string; orderId: string };
    entryReason?: string;
    entryResult?: { price: string; orderId: string };
    exitReason?: string;
    closedAt?: number | string;
    filledAt?: number | string;
    highestPrice?: number;
    lowestPrice?: number;
    activeStopLoss?: number;
    activeTakeProfit?: number;
    tpTriggered?: boolean;
    tslActivated?: boolean;
    entryTriggered?: boolean;
    activityLog?: Array<{
      time: number;
      type:
        | "ENTRY"
        | "SL_NEAR"
        | "TP_TEST"
        | "TTP_ACTIVE"
        | "TSL_ACTIVE"
        | "SL_UPDATE"
        | "TP_UPDATE"
        | "SL_HIT"
        | "TP_HIT"
        | "AI_SIGNAL"
        | "WHALE"
        | "MTF_CHANGE"
        | "ERROR"
        | "F4_SIGNAL"
        | "PRICE_UPDATE"
        | "STATUS_CHANGE";
      message: string;
      data?: Record<string, unknown>;
    }>;
    slUpdateHistory?: Array<{ time: number; from: number; to: number }>;
    tpUpdateHistory?: Array<{ time: number; from: number; to: number }>;
    peakDrawdown?: number;
    payload: {
      symbol: string;
      amount: string;
      buyPrice: string;
      buyType: string;
      trailingBuy?: boolean;
      trailingBuyDev?: number;
      takeProfit?: {
        price: string;
        type?: string;
        trailing?: boolean;
        deviation?: number;
        isSplit?: boolean;
        targets?: { price: string; volume: string }[];
      } | null;
      stopLoss?: {
        price: string;
        type?: string;
        trailing?: boolean;
        deviation?: number;
        timeout?: boolean;
        timeoutSeconds?: number;
        breakeven?: boolean;
      } | null;
    };
  };
}

export function calculateTradePnl(
  side: "BUY" | "SELL",
  mode: string,
  entry: number,
  currentPrice: number,
  qty: number,
) {
  // MEXC Actual: Taker Fees (~0.05% x 2) + Optimal Spread/Slippage (~0.05% x 2) = ~0.2% Total Round-trip
  const FEES_PCT = 0.2;
  
  const rawPnlPercent =
    side === "BUY" && mode !== "COVER"
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;

  const rawPnlUsdt =
    side === "BUY" && mode !== "COVER"
      ? qty * (currentPrice - entry)
      : qty * (entry - currentPrice);

  // NET PNL: (1 + raw) * (1 - fees) - 1
  const netPnlMultiplier = (1 + rawPnlPercent / 100) * (1 - FEES_PCT / 100);
  const pnlPercent = (netPnlMultiplier - 1) * 100;
  const pnlUsdt = (qty * entry * pnlPercent) / 100;

  return { pnlPercent, pnlUsdt };
}

export function calculateMtfVerdict(
  allTfs: {
    trend?: string;
    signal?: string | null;
    f4EarlyBuy?: boolean;
    f4ConfirmedBuy?: boolean;
    f4EarlySell?: boolean;
    f4ConfirmedSell?: boolean;
    aiScore?: number;
  }[],
  side: "BUY" | "SELL" = "BUY"
) {
  // If we are LONG (BUY), bullish is good. If we are SHORT (SELL), bearish is good.
  const bullCountRaw = allTfs.filter(
    (d) =>
      d &&
      (d.trend === "BULLISH" ||
        d.signal === "BUY" ||
        d.f4EarlyBuy ||
        d.f4ConfirmedBuy),
  ).length;
  
  const bearCountRaw = allTfs.filter(
    (d) =>
      d &&
      (d.trend === "BEARISH" ||
        d.signal === "SELL" ||
        d.f4EarlySell ||
        d.f4ConfirmedSell),
  ).length;

  // Context-aware scoring
  const goodCount = side === "BUY" ? bullCountRaw : bearCountRaw;
  const badCount = side === "BUY" ? bearCountRaw : bullCountRaw;
  
  const total = allTfs.length;
  const goodPct = total > 0 ? Math.round((goodCount / total) * 100) : 50;

  let verdictText = "NÖTR";
  let verdictColor = "text-amber-400";
  if (goodPct >= 70) {
    verdictText = "GÜÇLÜ AL";
    verdictColor = "text-emerald-400";
  } else if (goodPct >= 55) {
    verdictText = "AL";
    verdictColor = "text-emerald-300";
  } else if (goodPct <= 30) {
    verdictText = "GÜÇLÜ SAT";
    verdictColor = "text-rose-400";
  } else if (goodPct <= 45) {
    verdictText = "SAT";
    verdictColor = "text-rose-300";
  }

  const avgMtfScore =
    total > 0
      ? Math.round(allTfs.reduce((sum, d) => sum + (d.aiScore || 0), 0) / total)
      : 0;

  return {
    bullCount: bullCountRaw,
    bearCount: bearCountRaw,
    goodCount,
    badCount,
    total,
    goodPct,
    verdictText,
    verdictColor,
    avgMtfScore,
  };
}
