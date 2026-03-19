"use client";

import { SmartTradeOrder } from "@/components/ActiveSmartTrades";
import { calculateTrailingBuyTarget } from "./trading-logic";

export interface Indicator {
  name: string;
  value?: string;
  state: string;
  color: string;
}

export interface F4Live {
  v5Indicators?: Indicator[];
  marketRegime?: string;
  volatilityRegime?: string;
  zScoreValue?: number;
  liquidityZone?: string;
  vpa?: { state: string; buyVolume: number; sellVolume: number };
  adm?: { bias: string };
  whaleTrust?: number;
  tfAdaptFactor?: number;
  whaleDetected?: boolean;
  whaleStatus?: string;
  fundingRate?: number;
  fundingImpact?: string;
}

// --- Activity Log Event Types ---
export interface ActivityLogEntry {
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
  icon: string;
  color: string;
  data?: Record<string, unknown>;
}

// --- Synthesize Activity Logs from trade meta ---
// When the backend doesn't provide activityLog[], we build rich logs from available meta data
export function synthesizeActivityLog(
  trade: SmartTradeOrder,
  currentPrice: number,
  tp: number,
  sl: number,
  aiScore: number,
  statusText: string,
  isTtpActive: boolean,
  isTslActive: boolean,
  liveData: F4Live | null,
  mtfVerdictText?: string,
  bullCount?: number,
  bearCount?: number,
): ActivityLogEntry[] {
  const meta = trade.meta;
  const payload = meta.payload;
  const entry = trade.price;
  const logs: ActivityLogEntry[] = [];
  const isClosed = trade.status === "CLOSED";
  const mode = meta.mode || "TRADE";

  // 1. ENTRY EVENT — differentiate PENDING (TBUY waiting) vs FILLED (position open)
  const entryTime = meta.filledAt
    ? new Date(Number(meta.filledAt)).getTime()
    : trade.created_at;
  const isPending = trade.status === "PENDING";
  const hasTbuy = !!payload.trailingBuy;

  if (isPending && hasTbuy) {
    // TBUY bekliyor — henüz pozisyon açılmadı
    logs.push({
      time: entryTime || trade.created_at,
      type: "ENTRY",
      message: `Trailing Buy başlatıldı: $${entry.toLocaleString()} hedef fiyat, ${payload.trailingBuyDev || 1}% sapma ile takip ediliyor`,
      icon: "⏳",
      color: "text-cyan-400",
      data: { entry, qty: payload.amount, mode, tbuy: true },
    });
  } else if (isPending) {
    // Normal limit emir — henüz dolmadı
    logs.push({
      time: entryTime || trade.created_at,
      type: "ENTRY",
      message: `${mode === "COVER" ? "Satış" : "Alım"} emri oluşturuldu: $${entry.toLocaleString()} @ ${payload.amount} adet (BEKLEMEDE)`,
      icon: "📋",
      color: "text-amber-400",
      data: { entry, qty: payload.amount, mode },
    });
  } else {
    // FILLED — gerçek pozisyon açıldı
    logs.push({
      time: entryTime || trade.created_at,
      type: "ENTRY",
      message: `✅ İşlem açıldı: $${entry.toLocaleString()} fiyattan ${payload.amount} adet ${mode === "COVER" ? "SATIŞ" : "ALIŞ"}`,
      icon: mode === "COVER" ? "📤" : "📥",
      color: mode === "COVER" ? "text-rose-400" : "text-emerald-400",
      data: { entry, qty: payload.amount, mode },
    });
  }

  // 2. Entry reason
  if (meta.entryReason) {
    logs.push({
      time: entryTime + 100,
      type: "STATUS_CHANGE",
      message: `Giriş sebebi: ${meta.entryReason}`,
      icon: "📋",
      color: "text-cyan-400",
    });
  }

  // 3. Trailing Buy active
  if (payload.trailingBuy && trade.status === "PENDING") {
    if (meta.entryTriggered) {
      logs.push({
        time: entryTime + 250,
        type: "STATUS_CHANGE",
        message: `Trailing buy tetiklendi: Hedef fiyat ${mode === "COVER" ? "üzerine çıkıldı" : "altına inildi"}, şimdi ${payload.trailingBuyDev || 1}% sapma ile dönüş takip ediliyor`,
        icon: "🔍",
        color: "text-cyan-300",
        data: {
          highestPrice: meta.highestPrice,
          lowestPrice: meta.lowestPrice,
        }
      });
      // Add a live tracker log to simulate trailing execution distance visually
      const trailTgt = calculateTrailingBuyTarget(meta.mode as "TRADE" | "COVER" || "TRADE", Number(meta.highestPrice) || entry, Number(meta.lowestPrice) || entry, entry, payload.trailingBuyDev || 1);
      logs.push({
        time: Date.now() - 300,
        type: "PRICE_UPDATE",
        message: `Trailing Buy Takip Hedefi: $${trailTgt.toFixed(2)} (Mevcut Zirve/Dip: $${mode === "COVER" ? meta.highestPrice : meta.lowestPrice})`,
        icon: "⚡",
        color: "text-purple-400",
      });
    } else {
      logs.push({
        time: entryTime + 200,
        type: "STATUS_CHANGE",
        message: `Trailing Buy aktif: ${payload.trailingBuyDev || 1}% sapma ile takip ediliyor (Piyasa hedefe gelmesi bekleniyor)`,
        icon: "🔄",
        color: "text-cyan-300",
      });
    }
  }

  // 4. TP/SL Configuration
  if (tp > 0) {
    const tpPct =
      ((tp - entry) / entry) * 100 * (trade.side === "BUY" ? 1 : -1);
    logs.push({
      time: entryTime + 300,
      type: "TP_UPDATE",
      message: `TP hedefi belirlendi: $${tp.toLocaleString()} (${tpPct >= 0 ? "+" : ""}${tpPct.toFixed(2)}%)${payload.takeProfit?.trailing ? " [Trailing aktif]" : ""}`,
      icon: "🎯",
      color: "text-emerald-400",
      data: { tp, tpPct, trailing: !!payload.takeProfit?.trailing },
    });
  }

  if (sl > 0) {
    const slPct =
      ((sl - entry) / entry) * 100 * (trade.side === "BUY" ? 1 : -1);
    logs.push({
      time: entryTime + 400,
      type: "SL_UPDATE",
      message: `SL koruması belirlendi: $${sl.toLocaleString()} (${slPct >= 0 ? "+" : ""}${slPct.toFixed(2)}%)${payload.stopLoss?.trailing ? " [Trailing aktif]" : ""}`,
      icon: "🛡️",
      color: "text-rose-400",
      data: { sl, slPct, trailing: !!payload.stopLoss?.trailing },
    });
  }

  // 5. SL/TP Update History from backend
  if (meta.slUpdateHistory) {
    meta.slUpdateHistory.forEach((update) => {
      logs.push({
        time: update.time,
        type: "SL_UPDATE",
        message: `SL dinamik güncellendi: $${update.from.toFixed(2)} → $${update.to.toFixed(2)}`,
        icon: "⚠️",
        color: "text-amber-400",
        data: update,
      });
    });
  }

  if (meta.tpUpdateHistory) {
    meta.tpUpdateHistory.forEach((update) => {
      logs.push({
        time: update.time,
        type: "TP_UPDATE",
        message: `TP trailing ile güncellendi: $${update.from.toFixed(2)} → $${update.to.toFixed(2)}`,
        icon: "📈",
        color: "text-emerald-300",
        data: update,
      });
    });
  }

  // 6. Live status events (synthesized from current state)
  const now = Date.now();

  // TTP Active
  if (isTtpActive && !isClosed) {
    logs.push({
      time: now - 5000,
      type: "TTP_ACTIVE",
      message: `Trailing TP aktifleşti: Fiyat hedefi aştı, ${payload.takeProfit?.deviation || 0.3}% sapma ile takip ediliyor`,
      icon: "🚀",
      color: "text-emerald-400",
    });
  }

  // TSL Active
  if (isTslActive && !isClosed) {
    logs.push({
      time: now - 4000,
      type: "TSL_ACTIVE",
      message: `Trailing SL aktifleşti: En yüksek noktadan geri çekilme takip ediliyor`,
      icon: "🚨",
      color: "text-rose-400",
    });
  }

  // 7. SL Proximity Warning
  if (!isClosed && sl > 0 && currentPrice > 0) {
    const slDistance = Math.abs(((currentPrice - sl) / currentPrice) * 100);
    if (slDistance < 1.0) {
      logs.push({
        time: now - 3000,
        type: "SL_NEAR",
        message: `⚡ DİKKAT: Fiyat SL çizgisine ${slDistance.toFixed(2)}% mesafede! ($${currentPrice.toLocaleString()} → SL:$${sl.toLocaleString()})`,
        icon: "🔥",
        color: "text-rose-500",
        data: { slDistance, currentPrice, sl },
      });
    }
  }

  // 8. TP Proximity / Test
  if (!isClosed && tp > 0 && currentPrice > 0) {
    const tpDistance = Math.abs(((tp - currentPrice) / currentPrice) * 100);
    if (tpDistance < 0.5) {
      logs.push({
        time: now - 2000,
        type: "TP_TEST",
        message: `🎯 Fiyat TP çizgisini test ediyor: ${tpDistance.toFixed(2)}% uzakta ($${currentPrice.toLocaleString()} → TP:$${tp.toLocaleString()})`,
        icon: "🎯",
        color: "text-emerald-500",
        data: { tpDistance, currentPrice, tp },
      });
    }
  }

  // 9. AI Score Event
  if (aiScore > 0) {
    logs.push({
      time: now - 1500,
      type: "AI_SIGNAL",
      message: `AI Skoru: ${aiScore}% — ${aiScore >= 60 ? "Güçlü Güven" : aiScore >= 40 ? "Orta Güven" : "Zayıf Güven"} | Durum: ${statusText}`,
      icon: "🧠",
      color:
        aiScore >= 60
          ? "text-emerald-400"
          : aiScore >= 40
            ? "text-amber-400"
            : "text-rose-400",
      data: { aiScore, statusText },
    });
  }

  // 10. MTF Verdict
  if (mtfVerdictText && bullCount !== undefined && bearCount !== undefined) {
    logs.push({
      time: now - 1000,
      type: "MTF_CHANGE",
      message: `MTF Konsensüs: ${mtfVerdictText} | ${bullCount} Boğa vs ${bearCount} Ayı`,
      icon: "📡",
      color: mtfVerdictText.includes("AL")
        ? "text-emerald-400"
        : mtfVerdictText.includes("SAT")
          ? "text-rose-400"
          : "text-amber-400",
      data: { mtfVerdictText, bullCount, bearCount },
    });
  }

  // 11. Whale Detection from live data
  if (liveData && (liveData as Record<string, unknown>).whaleDetected) {
    logs.push({
      time: now - 800,
      type: "WHALE",
      message: `Balina Hareketi Algılandı: ${(liveData as Record<string, unknown>).whaleStatus || "Bilinmeyen"}`,
      icon: "🐋",
      color: "text-purple-400",
      data: { whaleStatus: (liveData as Record<string, unknown>).whaleStatus },
    });
  }

  // 12. Monitor Error
  if (meta.monitorError && !isClosed) {
    logs.push({
      time: now - 500,
      type: "ERROR",
      message: `Monitor Hatası: ${meta.monitorError === "VOLATILITY_GAP_PROTECTION" ? "Oynaklık Koruması Aktif (Bekleniyor)" : meta.monitorError}`,
      icon: "⚠️",
      color: "text-rose-500",
    });
  }

  // 12.1. Pilot Veto Warning
  if (meta.pilotVetoReason && !isClosed && !logs.some(l => l.message.includes("PİLOT KAPALI"))) {
    logs.push({
      time: now - 450,
      type: "ERROR",
      message: `✈️ PİLOT KAPALI: ${meta.pilotVetoReason} (İşlem gerçekleştirilemedi)`,
      icon: "✈️",
      color: "text-amber-400",
    });
  }

  // 13. Highest/Lowest Price tracking
  if (meta.highestPrice && Number(meta.highestPrice) > entry) {
    const peakPct = ((Number(meta.highestPrice) - entry) / entry) * 100;
    logs.push({
      time: now - 600,
      type: "PRICE_UPDATE",
      message: `Zirve fiyat kaydedildi: $${Number(meta.highestPrice).toLocaleString()} (+${peakPct.toFixed(2)}% giriş üstü)`,
      icon: "📊",
      color: "text-cyan-400",
      data: { highestPrice: meta.highestPrice, peakPct },
    });
  }

  // 14. Closed trade events
  if (isClosed) {
    if (meta.exitReason) {
      const exitTime = meta.closedAt
        ? new Date(Number(meta.closedAt)).getTime()
        : now;
      logs.push({
        time: exitTime,
        type: meta.exitReason.includes("TP")
          ? "TP_HIT"
          : meta.exitReason.includes("SL")
            ? "SL_HIT"
            : "STATUS_CHANGE",
        message: `Pozisyon kapatıldı: ${
          meta.exitReason === "MANUAL_PANIC_EXIT"
            ? "PANİK SATIŞ TETİKLENDİ"
            : meta.exitReason === "MANUAL_SILENT_EXIT"
              ? "Sessiz Arşiv (Pozisyon Korundu)"
              : meta.exitReason.includes("TP")
                ? "TP Hedefi Vuruldu ✅"
                : meta.exitReason.includes("SL")
                  ? "SL Koruması Tetiklendi ❌"
                  : meta.exitReason
        }`,
        icon: meta.exitReason.includes("TP")
          ? "✅"
          : meta.exitReason.includes("SL")
            ? "❌"
            : "🔒",
        color: meta.exitReason.includes("TP")
          ? "text-emerald-400"
          : "text-rose-400",
        data: { exitReason: meta.exitReason, exitPrice: meta.exitPrice },
      });
    }
  }

  // 15. Backend activity logs (if provided)
  if (meta.activityLog) {
    meta.activityLog.forEach((log) => {
      logs.push({
        time: log.time,
        type: log.type,
        message: log.message,
        icon: getIconForType(log.type),
        color: getColorForType(log.type),
        data: log.data,
      });
    });
  }

  // Sort by time descending (newest first)
  return logs.sort((a, b) => b.time - a.time);
}

function getIconForType(type: string): string {
  const map: Record<string, string> = {
    ENTRY: "📥",
    SL_NEAR: "🔥",
    TP_TEST: "🎯",
    TTP_ACTIVE: "🚀",
    TSL_ACTIVE: "🚨",
    SL_UPDATE: "⚠️",
    TP_UPDATE: "📈",
    SL_HIT: "❌",
    TP_HIT: "✅",
    AI_SIGNAL: "🧠",
    WHALE: "🐋",
    MTF_CHANGE: "📡",
    ERROR: "⚠️",
    F4_SIGNAL: "📟",
    PRICE_UPDATE: "📊",
    STATUS_CHANGE: "📋",
  };
  return map[type] || "📌";
}

function getColorForType(type: string): string {
  const map: Record<string, string> = {
    ENTRY: "text-emerald-400",
    SL_NEAR: "text-rose-500",
    TP_TEST: "text-emerald-500",
    TTP_ACTIVE: "text-emerald-400",
    TSL_ACTIVE: "text-rose-400",
    SL_UPDATE: "text-amber-400",
    TP_UPDATE: "text-emerald-300",
    SL_HIT: "text-rose-400",
    TP_HIT: "text-emerald-400",
    AI_SIGNAL: "text-cyan-400",
    WHALE: "text-purple-400",
    MTF_CHANGE: "text-amber-400",
    ERROR: "text-rose-500",
    F4_SIGNAL: "text-cyan-300",
    PRICE_UPDATE: "text-cyan-400",
    STATUS_CHANGE: "text-slate-400",
  };
  return map[type] || "text-slate-400";
}

// --- Live Duration Helper ---
export function formatLiveDuration(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}g ${hours % 24}s ${minutes % 60}d`;
  if (hours > 0) return `${hours}s ${minutes % 60}d ${seconds % 60}sn`;
  if (minutes > 0) return `${minutes}d ${seconds % 60}sn`;
  return `${seconds}sn`;
}

// --- Drawdown Calculator ---
export function calculateDrawdown(
  entry: number,
  highestPrice: number,
  currentPrice: number,
  side: "BUY" | "SELL",
): number {
  if (side === "BUY") {
    const peak = Math.max(entry, highestPrice);
    if (peak <= 0) return 0;
    return ((peak - currentPrice) / peak) * 100;
  } else {
    const trough = Math.min(entry, highestPrice);
    if (trough <= 0) return 0;
    return ((currentPrice - trough) / trough) * 100;
  }
}

// --- Risk/Reward Calculator ---
export function calculateRiskReward(
  entry: number,
  tp: number,
  sl: number,
  side: "BUY" | "SELL",
): string {
  if (tp <= 0 || sl <= 0) return "N/A";

  let reward: number, risk: number;
  if (side === "BUY") {
    reward = Math.abs(tp - entry);
    risk = Math.abs(entry - sl);
  } else {
    reward = Math.abs(entry - tp);
    risk = Math.abs(sl - entry);
  }

  if (risk <= 0) return "∞";
  const ratio = reward / risk;
  return `1:${ratio.toFixed(1)}`;
}
