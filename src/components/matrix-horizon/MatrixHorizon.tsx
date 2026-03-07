import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DecisionBar } from "./DecisionBar";
import { CentralCommand } from "./CentralCommand";
import { MatrixPortfolio } from "../MatrixPortfolio";
import { AssetIcon } from "../AssetIcon";
import {
  RefreshCw,
  LayoutTemplate,
  Brain,
  Cpu,
  Globe,
  Fish,
  BarChart2,
  Settings,
  Zap,
  Power,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Database,
  Newspaper,
  Activity,
} from "lucide-react";
import { fetchGlobalMarketData } from "@/lib/market-data";
import { useHoldings } from "@/hooks/usePortfolio";
import { api } from "@/services/api";
import axios from "axios";
import { useTimeframe } from "@/context/TimeframeContext";
import { analyzeSentiment, SentimentResult } from "@/lib/sentiment-analyzer";
import { AIAnalysisSummary } from "../AIAnalysisSummary";
import { logger } from "@/lib/logger";
import { PilotConfirmationModal } from "../PilotConfirmationModal";
import type { SmartTradeOrder } from "../ActiveSmartTrades";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface V5Indicator {
  name: string;
  value: string;
  state: string;
  color: "green" | "red" | "gray" | "orange";
}
interface ConfBreakdown {
  techScore: number;
  momentumScore: number;
  volumeScore: number;
  trendScore: number;
  marketScore: number;
  timingScore: number;
  totalScore: number;
  status: string;
}
export interface V5Signal {
  symbol: string;
  confluenceScore: number;
  confluenceBreakdown: ConfBreakdown;
  prediction: {
    upProb: number;
    downProb: number;
    text: string;
    direction: "UP" | "DOWN" | "FLAT";
  };
  systemDecision: "GO_LONG" | "GO_SHORT" | "WAIT";
  deathRisk: boolean;
  whaleTrust: number;
  marketRegime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  volatilityRegime: "SQUEEZE" | "HIGH_VOL" | "NORMAL";
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  v5Indicators: V5Indicator[];
  adm: { bias: string; classification: number; evidence: string };
  vpa: { netPressure: number; state: string };
  momentumState: string;
  mtfConsensus: string;
  mtfBullCount: number;
  whaleDetected: boolean;
  whaleSignalText: string;
  marketPhaseText: string;
  capitalPhase: string;
  capitalFlowText: string;
  regimePrediction: string;
  // SMC & Structure
  smc: {
    swingTrend: string;
    internalTrend: string;
    bos: boolean;
    choch: boolean;
    orderBlocks: { high: number; low: number; type: string }[];
    fvgs: { top: number; bottom: number; type: string }[];
  };
  liquidity: { eqHighs: boolean; eqLows: boolean };
  systemRestMode: boolean;
  vixBottom: boolean;
  inPremium: boolean;
  inDiscount: boolean;
  swingTrend: string;
  tfAdaptFactor: number;
  zScoreValue: number;

  // V5.3/V5.4 Intelligence Fields
  f4PowerLoss: number;
  f4EarlyBuy: boolean;
  f4EarlySell: boolean;
  f4ConfirmedBuy: boolean;
  f4ConfirmedSell: boolean;
  liquidityZone: string;
  liquidityBonus: number;
  mtfWeightedScore: number;
  dynamicWeights: {
    tech: number;
    momentum: number;
    market: number;
    trend: number;
  };
}
interface BotConfig {
  f4_length: number;
  whale_multiplier: number;
  ai_threshold: number;
  auto_trade: boolean;
  defense_mode: boolean;
  pilot_trailing_buy: boolean;
  pilot_trailing_buy_dev: number;
  pilot_tp_trailing: boolean;
  pilot_tp_deviation: number;
  pilot_sl_trailing: boolean;
  pilot_sl_deviation: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ic = (c: V5Indicator["color"]) =>
  ({
    green: "bg-emerald-500",
    red: "bg-rose-500",
    orange: "bg-amber-500",
    gray: "bg-slate-600",
  })[c];

const MiniBar = ({
  value,
  color = "bg-cyan-500",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) => (
  <div>
    {label && (
      <div className="flex justify-between text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(0)}</span>
      </div>
    )}
    <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 shadow-[0_0_5px_currentColor]",
          color,
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

const SH = ({
  icon,
  title,
  color = "text-slate-400",
}: {
  icon: React.ReactNode;
  title: string;
  color?: string;
}) => (
  <div
    className={cn(
      "flex items-center gap-2 mb-3 pb-1.5 border-b border-slate-800/30 text-xs font-black tracking-widest uppercase",
      color,
    )}
  >
    <span className="w-4 h-4 shrink-0 opacity-80">{icon}</span>
    {title}
  </div>
);

const Row = ({
  label,
  value,
  cls = "text-slate-300",
}: {
  label: string;
  value: React.ReactNode;
  cls?: string;
}) => (
  <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0 gap-1.5">
    <span className="text-slate-500 shrink-0 font-bold uppercase tracking-tight">
      {label}
    </span>
    <span className={cn("font-mono font-black text-right truncate ml-1", cls)}>
      {value}
    </span>
  </div>
);

const SliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  color,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  color: "cyan" | "indigo" | "purple" | "amber" | "emerald" | "rose";
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  const bg = {
    cyan: "bg-cyan-500",
    indigo: "bg-indigo-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
  }[color];
  const tx = {
    cyan: "text-cyan-400",
    indigo: "text-indigo-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    rose: "text-rose-400",
  }[color];
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
          {label}
        </span>
        <span className={cn("text-base font-black font-mono", tx)}>
          {value}
          {suffix}
        </span>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300",
            bg,
          )}
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>
    </div>
  );
};

export const MatrixHorizon = () => {
  const { refetch: refetchHoldings } = useHoldings();
  const { timeframe: interval } = useTimeframe();
  const [signal, setSignal] = useState<V5Signal | null>(null);
  const [btcDom, setBtcDom] = useState(0);
  const [usdtDom, setUsdtDom] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [socketOnline, setSocketOnline] = useState(true);
  const [riskMode, setRiskMode] = useState<"safe" | "normal" | "aggressive">(
    "aggressive",
  );

  // Command State
  const [config, setConfig] = useState<BotConfig>({
    f4_length: 10,
    whale_multiplier: 1.8,
    ai_threshold: 65,
    auto_trade: false,
    defense_mode: false,
    pilot_trailing_buy: true,
    pilot_trailing_buy_dev: 0.3,
    pilot_tp_trailing: true,
    pilot_tp_deviation: 0.5,
    pilot_sl_trailing: true,
    pilot_sl_deviation: 0.5,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showPilotModal, setShowPilotModal] = useState(false);
  const [existingTrades, setExistingTrades] = useState<SmartTradeOrder[]>([]);

  const [isPanicActive, setIsPanicActive] = useState(false);
  const [liveBtcPrice, setLiveBtcPrice] = useState<number | null>(null);
  const [prevLivePrice, setPrevLivePrice] = useState<number | null>(null);
  const [microDigits, setMicroDigits] = useState("00");

  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [prediction, setPrediction] = useState<{
    predictedPrice: number;
    trend: "UP" | "DOWN" | "FLAT";
    confidence: number;
  } | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Centralized BTC Ticker (using ApiCore for batching)
  useEffect(() => {
    const COMPONENT_ID = "MatrixHorizon_Ticker";
    // Register interest in BTCUSDT
    import("@/services/ApiCore").then(({ core }) => {
      core.market.registerSymbols(COMPONENT_ID, ["BTCUSDT"]);
      
      const unsub = core.market.subscribe((data) => {
        if (data["BTCUSDT"]) {
          const newPrice = parseFloat(data["BTCUSDT"].price);
          setLiveBtcPrice((prev) => {
            if (prev !== null) setPrevLivePrice(prev);
            return newPrice;
          });
          setCurrentPrice(newPrice);
        }
      });

      return () => {
        core.market.unregisterSymbols(COMPONENT_ID);
        unsub();
      };
    });

    // Fast visual micro-digit oscillator for the "microsecond" feel
    const microInterval = setInterval(() => {
      setMicroDigits(
        Math.floor(Math.random() * 100)
          .toString()
          .padStart(2, "0"),
      );
    }, 150);

    return () => clearInterval(microInterval);
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("isPanicActive") === "true"
    ) {
      setIsPanicActive(true);
    }
  }, []);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const res = await fetch(
          "https://min-api.cryptocompare.com/data/v2/news/?lang=EN",
        ).then((r) => r.json());
        const news = res.Data || [];
        setSentiment(
          analyzeSentiment(news.map((item: { title: string }) => item.title)),
        );
      } catch {
        /* silent */
      }
    };
    fetchSentiment();
  }, []);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const res = await api.get(
          `/indicators/f4?symbol=BTCUSDT&interval=${interval}`,
        );
        if (res.data && !res.data.error) {
          const d = res.data;
          setPrediction({
            predictedPrice:
              d.predictedPrice || d.currentPrice * (1 + (d.f4Slope || 0) / 100),
            trend:
              d.prediction?.direction ||
              (d.f4Slope > 0 ? "UP" : d.f4Slope < 0 ? "DOWN" : "FLAT"),
            confidence: d.confluenceScore || d.aiScore || 75,
          });
        }
      } catch {
        /* silent */
      }
    };
    fetchPrediction();
  }, [interval]);

  const rotation = sentiment ? (sentiment.score / 100) * 90 : 0;

  // Synchronize local config state with remote state and global timeframe
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        const res = await fetch("/api/bot/config").then((r) => r.json());
        if (res && !res.error) {
          setConfig((prev) => ({ ...prev, ...res }));
        }

        // Immediate session heartbeat for the console
        logger.info(
          "Matrix Engine Online",
          "Kullanıcı oturumu başlatıldı, tüm modüller senkronize ediliyor.",
        );
      } catch (err) {
        console.error("[MatrixHorizon] Config Load Error:", err);
      }
    };
    loadInitialConfig();
  }, []);

  // Fetch existing smart trades for pilot modal's open-order check
  const fetchExistingTrades = useCallback(async () => {
    try {
      const res = await api.get("/trade/smart");
      if (res.data && Array.isArray(res.data)) {
        setExistingTrades(res.data);
      }
    } catch { /* silent */ }
  }, []);

  // Also sync the timeframe in the local config when the global one changes (No longer needed since it is removed from BotConfig)

  const fetchSignal = useCallback(
    async (isManual = false) => {
      setSocketOnline(true);
      if (isManual) setIsActionLoading(true);
      try {
        const [r1, mkt] = await Promise.all([
          fetch(
            `/api/indicators/f4?symbol=BTCUSDT&interval=${interval}&riskMode=${riskMode}`,
          ).then((r) => r.json()),
          fetchGlobalMarketData().catch(() => null),
        ]);
        if (r1 && !r1.error) setSignal(r1);
        if (mkt) {
          setBtcDom(mkt.btcd?.value ?? 58.4);
          setUsdtDom(mkt.usdtd?.value ?? 4.2);
        }
        setLastSync(new Date());
      } catch {
        setSocketOnline(false);
      } finally {
        if (isManual) setIsActionLoading(false);
      }
    },
    [interval, riskMode],
  );

  // Periodical background refresh (Market analysis & Cron trigger)
  useEffect(() => {
    const id = setInterval(() => {
      fetchSignal(false);

      // If Pilot is ON, trigger a strategy execution cycle to keep it "live"
      if (config.auto_trade) {
        api.get("/cron/strategies").catch(() => null);
      }
    }, 30000);
    return () => clearInterval(id);
  }, [fetchSignal, config.auto_trade]);

  // Active triggers (Manual Load)
  useEffect(() => {
    fetchSignal(true);
  }, [interval, riskMode, fetchSignal]);

  const saveConfig = useCallback(async (updates: Partial<BotConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };

      // Log Pilot toggles ONLY if they actually changed
      if (
        updates.auto_trade !== undefined &&
        updates.auto_trade !== prev.auto_trade
      ) {
        logger.success(
          updates.auto_trade
            ? "✈️ OTOMATİK PİLOT AKTİF"
            : "⏸ OTOMATİK PİLOT DEVRE DIŞI",
          "Sistem PİLOT çalışma durumunu değiştirdi.",
        );
      }
      if (
        updates.defense_mode !== undefined &&
        updates.defense_mode !== prev.defense_mode
      ) {
        logger.info(
          updates.defense_mode
            ? "🛡️ SAVUNMA MODU ONLINE"
            : "🛡️ SAVUNMA MODU OFFLINE",
          "Bot savunma sistemi yapılandırması güncellendi.",
        );
      }

      // Log full config save ONLY if parameters actually changed
      if (Object.keys(updates).length > 2) {
        if (
          prev.f4_length !== next.f4_length ||
          prev.whale_multiplier !== next.whale_multiplier ||
          prev.ai_threshold !== next.ai_threshold ||
          prev.pilot_trailing_buy_dev !== next.pilot_trailing_buy_dev
        ) {
          logger.info(
            "⚙️ SİSTEM AYARLARI GÜNCELLENDİ",
            `F4: ${next.f4_length}, Balina: ${next.whale_multiplier}x, AI Güven: ${next.ai_threshold}%`,
          );
        }
      }
      return next;
    });

    // Only fire API if something changed
    try {
      await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      /* silent */
    }
  }, []);

  const handlePanicSell = async () => {
    if (!confirm("TÜM POZİSYONLARI KAPATMAK İSTEDİĞİNİZDEN EMİN MİSİNİZ?"))
      return;
    setIsActionLoading(true);
    console.log("[MatrixHorizon] Initiating Panic Sell request...");
    try {
      const res = await api.post("/panic/sell-all").then((r) => r.data);
      if (res.success) {
        alert(
          `PANİK SATIŞ TAMAMLANDI: ${res.results.length} varlık satıldı. Toplam: ${res.totalUsdtValue.toFixed(2)} USDT`,
        );
        setIsPanicActive(true);
        logger.error(
          "🚨 PANİK SATIŞ TETİKLENDİ",
          `Kullanıcı manuel olarak ${res.results.length} işlemi sonlandırdı.`,
        );
        refetchHoldings();
      } else {
        alert(`Sistem Hatası: ${res.message || "Satış yapılamadı"}`);
        logger.warn("⚠️ Panik Satış Başarısız", res.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[MatrixHorizon] Panic Sell Error:", err);
      alert(`Bağlantı Hatası: ${errorMessage || "Sunucuya ulaşılamadı"}`);
    }
    setIsActionLoading(false);
  };

  const handlePanicBuy = async () => {
    if (!confirm("PİYASAYA GERİ DÖNMEK İSTEDİĞİNİZDEN EMİN MİSİNİZ?")) return;
    setIsActionLoading(true);
    console.log("[MatrixHorizon] Initiating Panic Buy request...");
    try {
      const res = await api.post("/panic/buy-back").then((r) => r.data);
      console.log("[MatrixHorizon] Panic Buy Response:", res);
      if (res.success) {
        alert(
          `PANİK ALIM (GERİ AL) TAMAMLANDI: ${res.results.length} varlık geri alındı. Harcanan: ${res.totalSpent.toFixed(2)} USDT`,
        );
        setIsPanicActive(false);
        logger.success(
          "✅ PİYASAYA GERİ DÖNÜŞ",
          `Panik sonrası ${res.results.length} varlık tekrar satın alındı.`,
        );
        refetchHoldings();
      } else {
        alert(`Hata: ${res.message || "Alım yapılamadı"}`);
        logger.warn("⚠️ Geri Alım Başarısız", res.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[MatrixHorizon] Panic Buy Error:", err);
      alert(`Bağlantı Hatası: ${errorMessage || "Sunucuya ulaşılamadı"}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Derived
  const score = signal?.confluenceScore ?? 0;
  const upProb = signal?.prediction?.upProb ?? 50;
  const downProb = signal?.prediction?.downProb ?? 50;
  const sysDecision = signal?.systemDecision ?? "WAIT";
  const decisionText =
    sysDecision === "GO_LONG"
      ? "İŞLEM AÇ ✅"
      : sysDecision === "GO_SHORT"
        ? "SATIŞ YAP 📉"
        : "BEKLE ❌";

  return (
    <>
    <div className="w-full h-full min-h-[600px] bg-[#020617] relative px-4 py-1.5 flex flex-col gap-2 overflow-hidden rounded-xl border border-slate-800">
      {/* GRID BACKGROUND */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent pointer-events-none" />

      {/* HEADER BAR */}
      <div className="relative z-20 flex items-center justify-between pb-1 border-b border-slate-800/50 mb-1 font-mono">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-100 uppercase font-mono shadow-cyan-500/50 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
              CentralCommand
            </h2>
          </div>

          {/* SOCKET STATUS */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-full border border-slate-800">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                socketOnline
                  ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                socketOnline ? "text-emerald-400" : "text-rose-400",
              )}
            >
              SOCKET: {socketOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* TIMEFRAME INDICATOR (now controlled globally from sidebar) */}
          <div className="flex items-center bg-slate-950 rounded-lg px-3 py-1.5 border border-slate-800 ml-4">
            <span className="text-[10px] font-black text-cyan-400 tracking-widest uppercase font-mono">
              ⏱ {interval.toUpperCase()}
            </span>
          </div>
        </div>

        {/* CENTER: LIVE BTC TICKER (High Precision) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
           <div className="flex flex-col items-center group cursor-crosshair">
             <div className="flex items-center gap-2 px-2 py-1 relative">
                <div className="relative flex items-center gap-3 perspective-1000">
                    {/* 3D Rotating BTC Logo */}
                    <div className="relative transform-gpu transition-transform duration-1000 group-hover:rotate-y-180 preserve-3d">
                        {/* Outer Glow Circle */}
                        <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-md animate-pulse" />
                        <AssetIcon 
                            symbol="BTC" 
                            size={24} 
                            className="relative z-10 drop-shadow-[0_0_12px_rgba(247,147,26,0.8)] filter brightness-110 contrast-125" 
                        />
                    </div>
                    
                    <div className="flex items-baseline gap-1.5 font-mono relative">
                      {/* Numbers with 3D Depth/Shadow */}
                      <span className={cn(
                        "text-2xl font-black tracking-[-0.05em] transition-all duration-300 transform-gpu hover:scale-110",
                        "relative drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] [text-shadow:0_0_20px_var(--glow)]",
                        !liveBtcPrice ? "text-cyan-400 [--glow:rgba(34,211,238,0.6)]" : 
                        (prevLivePrice && liveBtcPrice >= prevLivePrice ? "text-emerald-400 [--glow:rgba(16,185,129,0.6)]" : "text-rose-400 [--glow:rgba(244,63,94,0.6)]")
                      )}>
                        {liveBtcPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "00000.00"}
                        
                        {/* 3D Glass Reflection Overlay */}
                        <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-50 rounded-t" />
                      </span>
                      
                      <span className="text-sm font-black text-slate-500/60 w-[20px] tabular-nums self-end mb-1">
                        {microDigits}
                      </span>
                    </div>
                </div>

                {/* Status Pulse Node - Minimal */}
                <div className={cn(
                  "absolute -right-2 top-1 w-1 h-1 rounded-full",
                  !liveBtcPrice ? "bg-cyan-500 animate-ping" : (prevLivePrice && liveBtcPrice >= prevLivePrice ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]")
                )} />
             </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_cyan]" />
            <span className="text-xs font-black text-cyan-400 tracking-widest uppercase">
              MatrixHorizon
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                if (!config.auto_trade) {
                  // Turning ON → fetch trades and show confirmation modal
                  fetchExistingTrades();
                  setShowPilotModal(true);
                } else {
                  // Turning OFF → just disable
                  saveConfig({ auto_trade: false });
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black uppercase transition-all",
                config.auto_trade
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "text-slate-500 hover:text-white",
              )}
            >
              <Power className="w-3.5 h-3.5" />{" "}
              {config.auto_trade ? "PİLOT ON" : "PİLOT OFF"}
            </button>
            <div className="w-[1px] h-3.5 bg-slate-800 mx-1.5" />
            <button
              onClick={() => saveConfig({ defense_mode: !config.defense_mode })}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black uppercase transition-all",
                config.defense_mode
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-500 hover:text-white",
              )}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> SAVUNMA
            </button>
            <div className="w-[1px] h-3.5 bg-slate-800 mx-1.5" />
            {!isPanicActive ? (
              <button
                disabled={isActionLoading}
                onClick={handlePanicSell}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black uppercase text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> PANİK SAT
              </button>
            ) : (
              <button
                disabled={isActionLoading}
                onClick={handlePanicBuy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-black uppercase text-emerald-500 hover:bg-emerald-500/10 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 underline decoration-emerald-500/50 underline-offset-2" />{" "}
                GERİ AL
              </button>
            )}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-1.5 rounded-lg border transition-all",
              showSettings
                ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                : "border-slate-800 text-slate-500 hover:text-white",
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div className="relative z-30 bg-slate-950/90 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 grid grid-cols-1 md:grid-cols-12 gap-8 animate-in slide-in-from-top-4 duration-300 mb-2">
          {/* COL 1: ENGINE SETTINGS */}
          <div className="md:col-span-3 space-y-6">
            <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest mb-2 pb-2 border-b border-white/5">
              <Zap className="w-4 h-4 text-cyan-400" /> MOTOR AYARLARI
            </div>
            <SliderField
              label="F4 Hassasiyeti"
              value={config.f4_length}
              min={5}
              max={50}
              onChange={(v) => setConfig((prev) => ({ ...prev, f4_length: v }))}
              color="cyan"
            />
            <SliderField
              label="Balina Çarpanı"
              value={config.whale_multiplier}
              min={1}
              max={5}
              step={0.1}
              suffix="x"
              onChange={(v) =>
                setConfig((prev) => ({ ...prev, whale_multiplier: v }))
              }
              color="indigo"
            />
            <SliderField
              label="AI Güven Eşiği"
              value={config.ai_threshold}
              min={50}
              max={95}
              suffix="%"
              onChange={(v) =>
                setConfig((prev) => ({ ...prev, ai_threshold: v }))
              }
              color="purple"
            />
          </div>

          {/* COL 2: PILOT CONFIGURATION */}
          <div className="md:col-span-5 space-y-5 px-6 border-x border-white/5">
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest mb-2 pb-2 border-b border-white/10">
              <Power className="w-4 h-4" /> PİLOT YAPILANDIRMASI (SMART TRADE)
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Gecikmeli Alım
                  </span>
                  <button
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        pilot_trailing_buy: !prev.pilot_trailing_buy,
                      }))
                    }
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all",
                      config.pilot_trailing_buy
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-900 text-slate-600 border border-slate-800",
                    )}
                  >
                    {config.pilot_trailing_buy ? "AKTİF" : "PASİF"}
                  </button>
                </div>
                <SliderField
                  label="Alım Sapma"
                  value={config.pilot_trailing_buy_dev}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  suffix="%"
                  onChange={(v) =>
                    setConfig((prev) => ({
                      ...prev,
                      pilot_trailing_buy_dev: v,
                    }))
                  }
                  color="amber"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    TP Trailing
                  </span>
                  <button
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        pilot_tp_trailing: !prev.pilot_tp_trailing,
                      }))
                    }
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-black uppercase transition-all",
                      config.pilot_tp_trailing
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-900 text-slate-600 border border-slate-800",
                    )}
                  >
                    {config.pilot_tp_trailing ? "AKTİF" : "PASİF"}
                  </button>
                </div>
                <SliderField
                  label="TP Deviation"
                  value={config.pilot_tp_deviation}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  suffix="%"
                  onChange={(v) =>
                    setConfig((prev) => ({ ...prev, pilot_tp_deviation: v }))
                  }
                  color="emerald"
                />
              </div>
            </div>

            <div className="pt-2">
              <SliderField
                label="SL Trailing Deviation (Kalkış)"
                value={config.pilot_sl_deviation}
                min={0.1}
                max={2.0}
                step={0.1}
                suffix="%"
                onChange={(v) =>
                  setConfig((prev) => ({ ...prev, pilot_sl_deviation: v }))
                }
                color="rose"
              />
            </div>
          </div>

          {/* COL 3: CONSOLE & SAVE */}
          <div className="md:col-span-4 flex flex-col gap-4">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-[11px] text-slate-400 font-mono leading-relaxed flex-1 shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-all duration-500" />
              <span className="text-cyan-400 font-bold block mb-3 uppercase text-[10px] tracking-widest flex items-center gap-2">
                <Activity size={12} /> ENGINE CONSOLE
              </span>
              <div className="space-y-1.5 opacity-80">
                <div>{">"} Matrix V5.3 Smart Engine Ready</div>
                <div>
                  {">"} Threshold: {config.ai_threshold}% | Sentiment:{" "}
                  {sentiment?.label || "Neutral"}
                </div>
                <div>
                  {">"} Pilot Redirection:{" "}
                  {config.pilot_trailing_buy
                    ? "Active (Smart Buy)"
                    : "Direct (Market)"}
                </div>
                <div>{">"} Waiting for Pilot Action...</div>
              </div>
            </div>

            <button
              onClick={() => {
                setIsActionLoading(true);
                saveConfig(config).finally(() => {
                  setTimeout(() => {
                    setIsActionLoading(false);
                    setShowSettings(false);
                  }, 800);
                });
              }}
              disabled={isActionLoading}
              className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-black uppercase rounded-xl shadow-[0_5px_20px_-5px_rgba(8,145,178,0.5)] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              {isActionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 fill-white" />
              )}
              YAPILANDIRMAYI SİSTEME KAYDET
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED COCKPIT LAYOUT */}
      <div className="flex-1 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT WING: INTELLIGENCE & STRUCTURE ── */}
        <div className="col-span-1 lg:col-span-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* SECTION 1: AI CONFLUENCE (No redundant score) */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-2">
            <SH
              icon={<Brain size={11} />}
              title="AI Güven Analizi"
              color="text-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2 py-1">
              <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-center">
                <div className="text-xs text-slate-500 uppercase font-black mb-1.5">
                  YUKARI POT.
                </div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  {upProb.toFixed(0)}%
                </div>
              </div>
              <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded text-center">
                <div className="text-xs text-slate-500 uppercase font-black mb-1.5">
                  AŞAĞI POT.
                </div>
                <div className="text-base font-black text-rose-400 font-mono">
                  {downProb.toFixed(0)}%
                </div>
              </div>
            </div>
            <Row
              label="Tahmin"
              value={signal?.prediction?.text ?? "---"}
              cls={
                upProb >= 60
                  ? "text-emerald-400"
                  : downProb >= 60
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
            {signal?.confluenceBreakdown && (
              <div className="space-y-1.5 pt-1">
                <MiniBar
                  value={signal.confluenceBreakdown.momentumScore}
                  color="bg-violet-500"
                  label="İVME DURUMU"
                />
                <MiniBar
                  value={signal.confluenceBreakdown.trendScore}
                  color="bg-emerald-500"
                  label="TREND GÜCÜ"
                />
                <MiniBar
                  value={signal.confluenceBreakdown.volumeScore}
                  color="bg-amber-500"
                  label="HACİM KALİTESİ"
                />
              </div>
            )}
          </div>

          {/* SECTION 2: SMC & STRUCTURE (V5 PRO) */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-1">
            <SH
              icon={<Layers size={11} />}
              title="SMC & Yapı (PRO)"
              color="text-indigo-400"
            />
            <Row
              label="Trend"
              value={
                signal?.smc?.swingTrend === "BULLISH"
                  ? "Boğa Trendi 📈"
                  : signal?.smc?.swingTrend === "BEARISH"
                    ? "Ayı Trendi 📉"
                    : "Yatay"
              }
              cls={
                signal?.smc?.swingTrend === "BULLISH"
                  ? "text-emerald-400"
                  : signal?.smc?.swingTrend === "BEARISH"
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
            <div className="grid grid-cols-2 gap-2.5 my-2">
              <div
                className={cn(
                  "text-[10px] p-1.5 rounded border text-center font-black",
                  signal?.smc?.bos
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "bg-slate-800/20 border-slate-800/50 text-slate-600",
                )}
              >
                YAPI KIRILIMI (BOS)
              </div>
              <div
                className={cn(
                  "text-[10px] p-1.5 rounded border text-center font-black",
                  signal?.smc?.choch
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                    : "bg-slate-800/20 border-slate-800/50 text-slate-600",
                )}
              >
                KARAKTER DEĞİŞİMİ (CHoCH)
              </div>
            </div>
            <Row
              label="İndirim/Prim"
              value={
                signal?.inDiscount
                  ? "İNDİRİM (BUY) 🏷️"
                  : signal?.inPremium
                    ? "PRİM (SELL) 💎"
                    : "DENGE (EQ) ⚖️"
              }
              cls={
                signal?.inDiscount
                  ? "text-emerald-400"
                  : signal?.inPremium
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
            <div className="pt-2 mt-2 border-t border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 mb-2 uppercase font-black tracking-tight">
                Aktif Bölgeler
              </div>
              <Row
                label="Order Blocks"
                value={
                  signal?.smc?.orderBlocks?.length
                    ? `${signal.smc.orderBlocks.length} Aktif`
                    : "Yok"
                }
                cls="text-indigo-400"
              />
              <Row
                label="Gap (FVG)"
                value={
                  signal?.smc?.fvgs?.length
                    ? `${signal.smc.fvgs.length} Tespit`
                    : "Temiz"
                }
                cls="text-amber-400"
              />
            </div>
          </div>

          {/* NEW: KÜRESEL NABIZ & PREDICTION (span 2) */}
          <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-3">
            <SH
              icon={<Newspaper size={11} />}
              title="Küresel Nabız & On-Chain Tahmin"
              color="text-amber-400"
            />

            <div className="flex items-center justify-between bg-slate-950/40 px-4 py-3 rounded-lg border border-white/5 relative group overflow-hidden">
              <div className="flex items-center gap-4 relative z-10 w-full">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Haber & Sosyal Durum:
                </span>
                <div className="flex items-center gap-3 ml-auto">
                  <span
                    className={cn(
                      "text-lg font-black uppercase tracking-widest leading-none drop-shadow-[0_0_10px_currentColor]",
                      (sentiment?.score || 0) >= 20
                        ? "text-emerald-400"
                        : (sentiment?.score || 0) <= -20
                          ? "text-rose-400"
                          : "text-amber-400",
                    )}
                  >
                    {sentiment?.label || "Nötr"}
                  </span>
                  <div className="relative w-10 h-5 overflow-hidden shrink-0 mt-0.5">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-800/30 rounded-t-full border border-white/5" />
                    <div
                      className={cn(
                        "absolute top-0 left-0 w-full h-full rounded-t-full origin-bottom transition-all duration-1000",
                        (sentiment?.score || 0) > 0
                          ? "bg-emerald-500/40"
                          : "bg-rose-500/40",
                      )}
                      style={{ transform: `rotate(${rotation}deg)` }}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 w-[1.5px] h-5 bg-white origin-bottom -translate-x-1/2 shadow-[0_0_10px_white]"
                      style={{
                        transform: `translateX(-50%) rotate(${rotation}deg)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 relative z-10">
              <div className="flex flex-col p-3 rounded-xl bg-slate-950/40 border border-white/5">
                <span className="text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">
                  Canlı Fiyat [{interval}]
                </span>
                <span className="text-sm font-mono font-black text-slate-100">
                  ${currentPrice?.toLocaleString() || "---"}
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-slate-950/40 border border-white/5 items-end text-right">
                <span className="text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">
                  Projeksiyon
                </span>
                <span
                  className={cn(
                    "text-sm font-mono font-black drop-shadow-[0_0_8px_currentColor]",
                    prediction?.trend === "UP"
                      ? "text-emerald-400"
                      : "text-rose-400",
                  )}
                >
                  $
                  {prediction?.predictedPrice?.toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  }) || "---"}
                </span>
              </div>
            </div>
            <div className="space-y-2.5 relative z-10 px-1">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.15em]">
                <span className="text-slate-500">AI Güven Modülü</span>
                <span className="text-cyan-400 font-mono text-xs">
                  {(prediction?.confidence || 0).toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2.5 bg-slate-950 rounded-full border border-white/5 overflow-hidden p-[1px]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_currentColor]",
                    (prediction?.confidence || 0) > 75
                      ? "bg-emerald-500"
                      : "bg-cyan-500",
                  )}
                  style={{ width: `${prediction?.confidence || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: V5 ONAY NOKTALARI */}
          <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3">
            <SH
              icon={<BarChart2 size={11} />}
              title="V5 İndikatör Sinyalleri"
              color="text-emerald-400"
            />
            <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
              {(signal?.v5Indicators ?? []).map((ind, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2"
                  title={`${ind.name}: ${ind.state}`}
                >
                  <span
                    className={cn(
                      "w-full h-3 rounded-full shadow-[0_0_8px_currentColor]",
                      ic(ind.color),
                    )}
                  />
                  <span className="text-xs text-slate-500 font-black uppercase truncate w-full text-center tracking-tighter">
                    {ind.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: THE ENGINE EYE ── */}
        <div
          className={cn(
            "col-span-1 lg:col-span-4 flex flex-col items-center justify-start relative min-h-[350px] transition-opacity duration-300",
            isActionLoading ? "opacity-40 animate-pulse" : "opacity-100",
          )}
        >
          <div className="relative flex-shrink-0 flex flex-col items-center justify-center mt-4">
            <CentralCommand
              score={score}
              status={
                signal?.whaleSignalText ||
                (signal?.whaleDetected ? "BALİNA GİRİŞİ 🐳" : "NORMAL AKIŞ")
              }
              prediction={
                signal?.prediction?.text ||
                (prediction?.trend === "UP"
                  ? "YUKARI 📈"
                  : prediction?.trend === "DOWN"
                    ? "AŞAĞI 📉"
                    : "ANALİZ EDİLİYOR...")
              }
            />
            <div className="absolute top-[-25px] bg-slate-900/60 backdrop-blur-xl px-5 py-2.5 rounded-xl border border-slate-700/50 text-xs text-slate-400 font-mono w-max uppercase tracking-widest flex items-center gap-3 shadow-2xl">
              <RefreshCw
                className={cn(
                  "w-4 h-4 text-cyan-500",
                  !lastSync && "animate-spin",
                )}
              />
              SERMAYE AKIŞI:{" "}
              <span
                className={
                  signal?.capitalPhase === "GİRİŞ"
                    ? "text-emerald-400 font-black glow-text-emerald"
                    : signal?.capitalPhase === "ÇIKIŞ" ||
                        signal?.capitalPhase === "NO_CAPITAL"
                      ? "text-rose-400 font-black"
                      : "text-amber-400 font-black"
                }
              >
                {signal?.capitalFlowText || "BEKLENİYOR"}
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm mt-8 space-y-4">
            {/* AI ANALYSIS SUMMARY (Dynamic) */}
            <div className="w-full mt-auto">
              <AIAnalysisSummary signal={signal} />
            </div>
          </div>

          {signal?.deathRisk && (
            <div className="bg-rose-500/20 border border-rose-500/50 rounded-full text-rose-400 text-[11px] font-black animate-pulse shadow-[0_0_30px_rgba(244,63,94,0.3)] uppercase tracking-[0.2em] px-8 py-2.5 mt-8">
              🛑 KİLL SWİTCH DEVREDE
            </div>
          )}
        </div>

        {/* ── RIGHT WING: MARKET & HEALTH ── */}
        <div className="col-span-1 lg:col-span-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* SECTION 4: MARKET DYNAMICS */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-2">
            <SH
              icon={<Globe size={11} />}
              title="Piyasa Dinamiği"
              color="text-blue-400"
            />
            {[
              { label: "BTC HAKİMİYET", val: btcDom, color: "bg-amber-500" },
              { label: "USDT REZERV", val: usdtDom, color: "bg-cyan-500" },
            ].map(({ label, val, color }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">
                    {label}
                  </span>
                  <span className="font-mono font-bold text-slate-300">
                    {val.toFixed(1)}%
                  </span>
                </div>
                <MiniBar value={val} color={color} />
              </div>
            ))}
            <Row
              label="Piyasa Rejimi"
              value={
                signal?.marketRegime === "RISK_ON"
                  ? "RISK-ON ✅"
                  : signal?.marketRegime === "RISK_OFF"
                    ? "RISK-OFF 🔴"
                    : "NÖTR"
              }
              cls={
                signal?.marketRegime === "RISK_ON"
                  ? "text-emerald-400"
                  : signal?.marketRegime === "RISK_OFF"
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
            <Row
              label="Gelecek Tahmin"
              value={signal?.regimePrediction?.replace(/_/g, " ") ?? "---"}
              cls="text-amber-300"
            />
          </div>

          {/* SECTION 5: WHALE & LIQUIDITY */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-1">
            <SH
              icon={<Fish size={11} />}
              title="Balina & Likidite"
              color="text-teal-400"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div
                className={cn(
                  "text-[10px] p-1.5 rounded border text-center font-black uppercase",
                  signal?.liquidity?.eqHighs
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse"
                    : "bg-slate-800/20 border-slate-800/50 text-slate-600",
                )}
              >
                EŞİT TEPELER (LİKİDİTE)
              </div>
              <div
                className={cn(
                  "text-[10px] p-1.5 rounded border text-center font-black uppercase",
                  signal?.liquidity?.eqLows
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse"
                    : "bg-slate-800/20 border-slate-800/50 text-slate-600",
                )}
              >
                EŞİT DİPLER (LİKİDİTE)
              </div>
            </div>
            <Row
              label="Z-Skor (Drift)"
              value={(signal?.zScoreValue ?? 0).toFixed(2)}
              cls={
                Math.abs(signal?.zScoreValue ?? 0) > 2
                  ? "text-rose-400"
                  : "text-emerald-400"
              }
            />
            <Row
              label="Balina Güven"
              value={`${((signal?.whaleTrust ?? 0) * 100).toFixed(1)}%`}
              cls={
                (signal?.whaleTrust ?? 0) > 0.6
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            />
            <div className="mt-2 pt-2 border-t border-white/5">
              <Row
                label="MTF Uzlaşı"
                value={signal?.mtfConsensus ?? "---"}
                cls="text-cyan-400"
              />
            </div>
          </div>

          {/* NEW: SADELEŞTİRİLMİŞ ON-CHAIN TABLOSU (span 2) */}
          <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-2">
            <SH
              icon={<Database size={11} />}
              title="Sadeleştirilmiş On-Chain Verisi"
              color="text-emerald-400"
            />
            <div className="bg-black/40 rounded-lg border border-white/5 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5">
                    <th className="py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest w-1/3">
                      Metrik
                    </th>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest w-1/3">
                      Anlam
                    </th>
                    <th className="py-2 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest w-1/3 text-right">
                      Yorum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 disabled:divide-transparent">
                  {[
                    {
                      m: "VPA Baskı",
                      a: (signal?.vpa?.netPressure ?? 0).toFixed(2),
                      y: signal?.vpa?.state ?? "Beklemede",
                      status:
                        (signal?.vpa?.netPressure ?? 0) > 0.5
                          ? "good"
                          : (signal?.vpa?.netPressure ?? 0) < -0.5
                            ? "bad"
                            : "neutral",
                    },
                    {
                      m: "Balina Güveni",
                      a: `${((signal?.whaleTrust ?? 0) * 100).toFixed(1)}%`,
                      y: (signal?.whaleTrust ?? 0) > 0.6 ? "Yüksek" : "Normal",
                      status:
                        (signal?.whaleTrust ?? 0) > 0.6
                          ? "good"
                          : (signal?.whaleTrust ?? 0) < 0.3
                            ? "bad"
                            : "neutral",
                    },
                    {
                      m: "Sermaye Akışı",
                      a: signal?.capitalPhase ?? "Bilinmiyor",
                      y: signal?.capitalFlowText ?? "Para Yok ❌",
                      status:
                        signal?.capitalPhase === "GİRİŞ"
                          ? "good"
                          : signal?.capitalPhase === "ÇIKIŞ"
                            ? "bad"
                            : "neutral",
                    },
                    {
                      m: "Piyasa Fazı",
                      a: signal?.marketPhaseText ?? "Akümülasyon",
                      y:
                        signal?.marketRegime === "RISK_ON"
                          ? "Risk-On"
                          : "Risk-Off",
                      status:
                        signal?.marketRegime === "RISK_ON"
                          ? "good"
                          : signal?.marketRegime === "RISK_OFF"
                            ? "bad"
                            : "neutral",
                    },
                    {
                      m: "Ayı/Boğa Gücü",
                      a: signal?.mtfConsensus ?? "Nötr",
                      y: `${signal?.mtfBullCount ?? 0} TF Boğa`,
                      status:
                        (signal?.mtfBullCount ?? 0) >= 3
                          ? "good"
                          : (signal?.mtfBullCount ?? 0) <= 1
                            ? "bad"
                            : "neutral",
                    },
                    {
                      m: "Derin Bias",
                      a: signal?.adm?.bias ?? "Nötr",
                      y: signal?.adm?.evidence ?? "YOK",
                      status:
                        signal?.adm?.bias === "BULLISH"
                          ? "good"
                          : signal?.adm?.bias === "BEARISH"
                            ? "bad"
                            : "neutral",
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td
                        className={cn(
                          "py-2 px-3 text-[10px] font-black uppercase whitespace-nowrap",
                          row.status === "good"
                            ? "text-emerald-400"
                            : row.status === "bad"
                              ? "text-rose-400"
                              : "text-slate-400",
                        )}
                      >
                        {row.m}
                      </td>
                      <td className="py-2 px-3 text-[9px] font-medium text-slate-400 leading-tight">
                        {row.a}
                      </td>
                      <td
                        className={cn(
                          "py-2 px-3 text-[9px] font-bold text-right leading-tight",
                          row.status === "good"
                            ? "text-emerald-500"
                            : row.status === "bad"
                              ? "text-rose-500"
                              : "text-slate-500",
                        )}
                      >
                        {row.y}{" "}
                        {row.status === "good"
                          ? "✅"
                          : row.status === "bad"
                            ? "❌"
                            : "⚪"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 6: SYSTEM INTEGRITY (MatrixV5.pine feature) */}
          <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3">
            <SH
              icon={<Cpu size={11} />}
              title="Sistem Sağlığı & Engine"
              color="text-purple-400"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Row
                  label="VOL. REJİM"
                  value={signal?.volatilityRegime ?? "NORMAL"}
                  cls={
                    signal?.volatilityRegime === "SQUEEZE"
                      ? "text-purple-400 animate-pulse font-black"
                      : "text-slate-400"
                  }
                />
                <Row
                  label="F4 GÜCÜ"
                  value={`%${(100 - (signal?.f4PowerLoss ?? 0)).toFixed(0)}`}
                  cls={
                    (signal?.f4PowerLoss ?? 0) > 40
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }
                />
                <Row
                  label="LİKİDİTE"
                  value={signal?.liquidityZone || "YOK"}
                  cls={
                    signal?.liquidityZone?.includes("BOĞA")
                      ? "text-emerald-400"
                      : signal?.liquidityZone?.includes("AYI")
                        ? "text-rose-400"
                        : "text-slate-500"
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Row
                  label="ADAPTASYON"
                  value={signal?.tfAdaptFactor?.toFixed(2) || "1.00"}
                  cls="text-amber-400"
                />
                <Row
                  label="AĞIRLIK. MTF"
                  value={`${signal?.mtfWeightedScore || 0}/5`}
                  cls="text-cyan-400"
                />
                <Row
                  label="DİN. AĞIRLIK"
                  value={
                    signal?.dynamicWeights?.market === 25
                      ? "RISK-OFF"
                      : "NORMAL"
                  }
                  cls={
                    signal?.dynamicWeights?.tech === 15
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div
                className={cn(
                  "py-2.5 bg-emerald-500/5 border rounded-xl text-center text-[10px] font-black uppercase tracking-widest",
                  signal?.f4EarlyBuy || signal?.f4ConfirmedBuy
                    ? "border-emerald-500/50 text-emerald-400 animate-pulse bg-emerald-500/10"
                    : "border-emerald-500/10 text-emerald-600/50",
                )}
              >
                {signal?.f4ConfirmedBuy
                  ? "ONAYLI AL"
                  : signal?.f4EarlyBuy
                    ? "ERKEN AL"
                    : "AL SİNYALİ YOK"}
              </div>
              <div
                className={cn(
                  "py-2.5 bg-rose-500/5 border rounded-xl text-center text-[10px] font-black uppercase tracking-widest",
                  signal?.f4EarlySell || signal?.f4ConfirmedSell
                    ? "border-rose-500/50 text-rose-400 animate-pulse bg-rose-500/10"
                    : "border-rose-500/10 text-rose-600/50",
                )}
              >
                {signal?.f4ConfirmedSell
                  ? "ONAYLI SAT"
                  : signal?.f4EarlySell
                    ? "ERKEN SAT"
                    : "SAT SİNYALİ YOK"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM DECK: EXECUTION & MODE SETTINGS */}
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex-1 w-full">
          <DecisionBar
            decision={
              decisionText as "İŞLEM AÇ ✅" | "SATIŞ YAP 📉" | "BEKLE ❌"
            }
            aiSuggestion={signal?.prediction?.text || "ANALİZ EDİLİYOR..."}
            mode={signal?.marketPhaseText || "KONSOLİDASYON"}
            riskMode={riskMode}
            onRiskModeChange={(val) => {
              setRiskMode(val);
              // Visual feedback: Trigger manual refetch to show changes
            }}
          />
        </div>
      </div>

      {/* ACTIVE SMART TRADES MOVED TO SMART OPERATION CENTER */}
      {/* ASSET LIST (MATRIX DASHBOARD) */}
      <div className="relative z-20 flex-1 overflow-visible">
        <div className="flex items-center gap-2 mb-2 px-1 font-mono">
          <div className="w-1 h-4 bg-cyan-500 rounded-sm shadow-[0_0_8px_cyan]" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            MatrixPortfolio
          </h3>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
        </div>
        <MatrixPortfolio />
      </div>
    </div>

    {/* ── Pilot Confirmation Modal ── */}
    <PilotConfirmationModal
      isOpen={showPilotModal}
      timeframe={interval}
      onClose={() => setShowPilotModal(false)}
      existingTrades={existingTrades}
      onComplete={() => {
        setShowPilotModal(false);
        saveConfig({ auto_trade: true });
        fetchExistingTrades();
      }}
    />
  </>);
};
