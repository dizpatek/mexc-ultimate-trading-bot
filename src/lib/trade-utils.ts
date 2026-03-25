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
    pilotVetoReason?: string;
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
  // P5.6: Enhanced MTF Weighted Scoring (Synced with mtf-engine.ts)
  let mtfBullScore = 0;
  let totalTfs = 0;

  allTfs.forEach(d => {
    if (!d) return;
    totalTfs++;
    
    // Check if d.bullWeight exists (new centralized format) or calculate it
    if (typeof (d as any).bullWeight === 'number') {
      mtfBullScore += (d as any).bullWeight;
    } else {
      // Legacy fallback: Calculate a weight from available flags
      let weight = 0.5; // Neutral start
      if (d.f4ConfirmedBuy || d.f4EarlyBuy) weight = 0.9;
      else if (d.f4ConfirmedSell || d.f4EarlySell) weight = 0.1;
      else if (d.signal === "BUY" || d.trend === "BULLISH") weight = 0.75;
      else if (d.signal === "SELL" || d.trend === "BEARISH") weight = 0.25;
      mtfBullScore += weight;
    }
  });

  const bullCountRaw = mtfBullScore;
  const bearCountRaw = totalTfs - mtfBullScore;

  // Context-aware scoring
  const goodCount = side === "BUY" ? bullCountRaw : bearCountRaw;
  const badCount = side === "BUY" ? bearCountRaw : bullCountRaw;
  
  const total = allTfs.length;
  const goodPct = total > 0 ? Math.round((goodCount / total) * 100) : 50;

  const bullPct = total > 0 ? Math.round((bullCountRaw / total) * 100) : 0;
  const bearPct = total > 0 ? Math.round((bearCountRaw / total) * 100) : 0;

  // [-100, +100] MTF Birleşik Skoru
  // 5 SAT → -100 | 5 AL → +100 | 3AL/2SAT → +20 | tam nötr → 0
  const mtfScore = total > 0 
    ? Math.round(((bullCountRaw - bearCountRaw) / total) * 100)
    : 0;

  // verdictText ve verdictColor basit bullPct/bearPct'e göre kalsın
  let verdictText = "NÖTR";
  let verdictColor = "text-amber-400";
  
  if (side === "BUY") {
    if (mtfScore >= 60) {
      verdictText = "GÜÇLÜ AL";
      verdictColor = "text-emerald-400";
    } else if (mtfScore >= 20) {
      verdictText = "AL";
      verdictColor = "text-emerald-300";
    } else if (mtfScore <= -60) {
      verdictText = "TERS TREND (SAT)";
      verdictColor = "text-orange-500 font-black animate-pulse bg-orange-500/10 px-1 rounded";
    } else if (mtfScore <= -20) {
      verdictText = "ZAYIF / AYI";
      verdictColor = "text-rose-300";
    }
  } else {
    // SELL / COVER Positioning
    if (mtfScore <= -60) {
      verdictText = "GÜÇLÜ SAT";
      verdictColor = "text-rose-400";
    } else if (mtfScore <= -20) {
      verdictText = "SAT";
      verdictColor = "text-rose-300";
    } else if (mtfScore >= 60) {
      verdictText = "TERS TREND (AL)";
      verdictColor = "text-orange-500 font-black animate-pulse bg-orange-500/10 px-1 rounded";
    } else if (mtfScore >= 20) {
      verdictText = "ZAYIF / BOĞA";
      verdictColor = "text-emerald-300";
    }
  }

  const avgMtfScore =
    total > 0
      ? Math.round(allTfs.reduce((sum, d) => sum + (d.aiScore || 0), 0) / total)
      : 0;

  const dominantPct = Math.max(bullPct, bearPct);
  const sentimentColor = bullPct >= bearPct ? "bg-emerald-500" : "bg-rose-500";

  return {
    bullCount: bullCountRaw,
    bearCount: bearCountRaw,
    goodCount,
    badCount,
    total,
    goodPct,
    bullPct,
    bearPct,
    mtfScore,          // ← YENİ: [-100, +100] birleşik skor
    dominantPct,
    sentimentColor,
    verdictText,
    verdictColor,
    avgMtfScore,
  };
}
