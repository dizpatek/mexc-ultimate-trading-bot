import React, { useState, useEffect, useCallback } from "react";
import { DEFAULT_BOT_CONFIG } from "@/lib/constants/bot-defaults";
import { cn } from "@/lib/utils";
import { DecisionBar } from "./DecisionBar";
import { CentralCommand } from "./CentralCommand";
import { AIAnalysisSummary } from "../AIAnalysisSummary";
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
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { fetchGlobalMarketData } from "@/lib/market-data";
import { useHoldings } from "@/hooks/usePortfolio";
import { api } from "@/services/api";
import { useTimeframe } from "@/context/TimeframeContext";
import { analyzeSentiment, SentimentResult } from "@/lib/sentiment-analyzer";

import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useTrade } from "@/context/TradeContext";
import { useNotification } from "@/context/NotificationContext";

// --- TYPES & INTERFACES ---
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
  fundingRate?: number | null;
  fundingImpact?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
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
  pilot_timeframe?: string;
  pilot_mtf_veto?: boolean;
  pilot_mtf_threshold?: number;
  pilot_only_holdings?: boolean;
  fibo_length: number;
  f4_power_loss_threshold: number; // F4 Güç Kaybı Eşiği
  timeframe_settings?: {
    tradeMode?: string;
    pilot_trade_allocation?: number;
    cover_tp_trailing?: boolean;
    cover_tp_deviation?: number;
    cover_sl_trailing?: boolean;
    cover_sl_deviation?: number;
    [key: string]: any;
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function resolveTradeMode(botConfig: BotConfig | null | undefined): "Scalp" | "Swing" {
  try {
    const tfSettings = (typeof botConfig?.timeframe_settings === "object" && botConfig?.timeframe_settings) || {};
    const mode = (tfSettings as Record<string, unknown>).tradeMode as string;
    if (mode === "Swing") return "Swing";
    return "Scalp";
  } catch {
    return "Scalp";
  }
}
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

export const MatrixHorizon = () => {
  const { refetch: refetchHoldings } = useHoldings();
  const { timeframe: interval } = useTimeframe();
  const { notify, confirm } = useNotification();
  const [signal, setSignal] = useState<V5Signal | null>(null);
  const [btcDom, setBtcDom] = useState(0);
  const [usdtDom, setUsdtDom] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [socketOnline, setSocketOnline] = useState(true);
  const [riskMode, setRiskMode] = useState<"safe" | "normal" | "aggressive">(
    () => (typeof window !== "undefined" ? (localStorage.getItem("mx_riskMode") as "safe" | "normal" | "aggressive" | null) ?? "aggressive" : "aggressive"),
  );

  // Command State
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [pilotStatus, setPilotStatus] = useState<"IDLE" | "SCANNING" | "EXECUTING">("IDLE");

  // Centralized trading mode helper to avoid redundant declarations
  const getActiveTradingMode = useCallback((): "test" | "production" =>
    (typeof window !== "undefined" && localStorage.getItem("TRADING_MODE") === "production")
      ? "production" : "test"
  , []);

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

  const { symbol: selectedAsset } = useTrade();
  const [aiSource, setAiSource] = useState<"ETH" | "ASSETS">("ETH");
  const activeSymbol = aiSource === "ASSETS" ? (selectedAsset || "BTCUSDT") : "ETHUSDT";

  // ─── ORCHESTRA CONDUCTOR (INLINED) ─────────────────────────────────────
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.is_admin === true;
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ verdict: string; direction: string; urgency: string; confidence: number; position_size: string; reasoning: string; tf_noise_warning?: boolean } | null>(null);
  const [aiRaw, setAiRaw] = useState<Record<string, any> | null>(null);
  const [aiErr, setAiErr] = useState("");
  const [aiShowRaw, setAiShowRaw] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0);
  const [aiHistory, setAiHistory] = useState<{ time: string; symbol: string; tf: string; verdict: string; confidence: number }[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai_orchestra_history");
    if (saved) {
      try { setAiHistory(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  // Cooldown ticker (non-admin only)
  useEffect(() => {
    if (isAdmin) { setAiCooldown(0); return; }
    const syncCooldown = () => {
      const lastGroq = localStorage.getItem("last_groq_call");
      if (lastGroq) {
        const msSince = Date.now() - parseInt(lastGroq);
        const limit = 10 * 60 * 1000;
        if (msSince < limit) setAiCooldown(Math.ceil((limit - msSince) / 1000));
      }
    };
    syncCooldown();
    const timer = setInterval(() => setAiCooldown(p => (p > 0 ? p - 1 : 0)), 1000);
    // Cross-tab sync
    const onStorage = (e: StorageEvent) => { if (e.key === "last_groq_call") syncCooldown(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(timer); window.removeEventListener("storage", onStorage); };
  }, [isAdmin]);

  const runAiAnalysis = async () => {
    if (!isAdmin && aiCooldown > 0) {
      setAiErr(`Rate limit aktif! ${aiCooldown}s bekleyin.`);
      return;
    }
    setAiLoading(true); setAiErr(""); setAiResult(null); setAiRaw(null);
    try {
      const res = await api.post("/analyze", {
        symbol: activeSymbol,
        timeframe: interval,
        isMeme: false,
        dashboardState: {
          signal: signal,
          sentiment: sentiment,
          config: config,
          price: currentPrice,
          prediction: prediction,
          globalMarket: {
            btcDom,
            usdtDom,
            riskMode,
          },
        },
      });
      const d = res.data;
      if (res.status !== 200) {
        if (res.status === 429 && !isAdmin) {
          localStorage.setItem("last_groq_call", Date.now().toString());
          setAiCooldown(600);
        }
        throw new Error(d.error || "Bilinmeyen API Hatası");
      }
      setAiRaw(d.rawData);
      setAiResult(d.result);
      
      // Update History
      const newEntry = {
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        symbol: activeSymbol,
        tf: interval,
        verdict: d.result.verdict,
        confidence: d.result.confidence
      };
      setAiHistory(prev => {
        const updated = [newEntry, ...prev.slice(0, 9)];
        localStorage.setItem("ai_orchestra_history", JSON.stringify(updated));
        return updated;
      });

      if (!d.isAdmin) {
        localStorage.setItem("last_groq_call", Date.now().toString());
        setAiCooldown(600);
      }
    } catch (e: unknown) {
      setAiErr("Hata: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiLoading(false);
    }
  };

  const AI_VS: Record<string, Record<string, string>> = {
    "GÜÇLÜ AL": { bg: "#052e16", border: "#22c55e", text: "#4ade80", icon: "🚀" },
    "AL": { bg: "#0a1f10", border: "#16a34a", text: "#86efac", icon: "✅" },
    "BEKLE": { bg: "#1c1917", border: "#78716c", text: "#a8a29e", icon: "⏳" },
    "SAT": { bg: "#2d0a0a", border: "#dc2626", text: "#fca5a5", icon: "🔻" },
    "GÜÇLÜ SAT": { bg: "#3d0a0a", border: "#ef4444", text: "#f87171", icon: "💀" },
    "KESİNLİKLE BEKLE": { bg: "#1c0a00", border: "#f97316", text: "#fdba74", icon: "🛑" },
  };
  const AI_PSC: Record<string, string> = { "TAM": "#22c55e", "YARIM": "#86efac", "ÇEYREK": "#f59e0b", "GİRME": "#ef4444" };
  const aiVs = aiResult ? AI_VS[aiResult.verdict] || AI_VS["BEKLE"] : null;

  // Centralized BTC Ticker (using ApiCore for batching)
  useEffect(() => {
    setCurrentPrice(null);
    const COMPONENT_ID = "MatrixHorizon_Ticker";
    // Register interest in both BTCUSDT (for top bar) and activeSymbol (for live box)
    const normalizedSymbol = activeSymbol.toUpperCase().replace(/\//g, "");
    
    import("@/services/ApiCore").then(({ core }) => {
      core.market.registerSymbols(COMPONENT_ID, ["BTCUSDT", normalizedSymbol]);
      
      const unsub = core.market.subscribe((data) => {
        // 1. Update Global BTC Ticker
        if (data["BTCUSDT"]) {
          const btcPrice = parseFloat(data["BTCUSDT"].price);
          setLiveBtcPrice((prev) => {
            if (prev !== null) setPrevLivePrice(prev);
            return btcPrice;
          });
          // If normalized activeSymbol is BTC, setCurrentPrice will be handled below anyway
          if (normalizedSymbol === "BTCUSDT") setCurrentPrice(btcPrice);
        }

        // 2. Update Active Asset Price (Canlı Fiyat Box)
        if (data[normalizedSymbol]) {
          const assetPrice = parseFloat(data[normalizedSymbol].price);
          setCurrentPrice(assetPrice);
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
  }, [activeSymbol]);

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

  // Prediction is derived from fetchSignal (no separate F4 call needed)

  const rotation = sentiment ? (sentiment.score / 100) * 90 : 0;

  // Synchronize local config state with remote state and global timeframe
  useEffect(() => {
    let isMounted = true;
    const loadInitialConfig = async () => {
      try {
        const res = await api.get("/bot/config");
        const data = res.data;
        if (isMounted && data && !data.error) {
          console.log("[MatrixHorizon] Initial config loaded:", data.auto_trade ? "PİLOT ON" : "PİLOT OFF");
          setConfig((prev) => ({ ...prev, ...data }));
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
    return () => { isMounted = false; };
  }, []);

  // Synchronize local config state with remote state and global timeframe

  const fetchSignal = useCallback(
    async (isManual = false) => {
      setSocketOnline(true);
      if (isManual) setIsActionLoading(true);
      try {
        const [res, mkt] = await Promise.all([
          api.get(
            `/indicators/f4?symbol=${activeSymbol}&interval=${interval}&riskMode=${riskMode}`,
          ),
          fetchGlobalMarketData().catch(() => null),
        ]);
        const r1 = res.data;
        if (r1 && !r1.error) {
          setSignal(r1);
          // Derive prediction from the same F4 response — no separate API call needed
          // Use r1.currentPrice (backend value) so we don't depend on possibly-null frontend currentPrice
          if (r1.prediction) {
            setPrediction({
              predictedPrice: r1.targets?.t1 ?? r1.currentPrice ?? 0,
              trend: r1.prediction.direction ?? "FLAT",
              confidence: r1.confluenceScore ?? 75,
            });
          }
        }
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
    [interval, riskMode, activeSymbol],
  );

  // Periodical background refresh (Market analysis & Cron trigger)
  useEffect(() => {
    // P4.4: Reduced background polling frequency to 30 seconds to optimize server load
    const id = setInterval(() => {
      // Pause polling if tab is hidden to save server resources (Kluster P4.1)
      if (document.visibilityState !== "visible") return;

      fetchSignal(false);

      // If Pilot is ON, trigger a strategy execution cycle to keep it "live"
      if (config.auto_trade) {
        const tradingMode = getActiveTradingMode();
        setPilotStatus("SCANNING");
        
        api.get(`/cron/strategies?immediate=true&tradingMode=${tradingMode}`)
          .then(async () => {
            // Check for new executed signals to update UI
            try {
              const signalsRes = await api.get(`/trade/signals?limit=5&tradingMode=${tradingMode}`);
              if (signalsRes.data && signalsRes.data.length > 0) {
                const latest = signalsRes.data[0];
                const signalTimeMs = Number(latest.timestamp);
                
                // If there's a recently executed signal, UI should refresh
                if (
                  !Number.isNaN(signalTimeMs) &&
                  Date.now() - signalTimeMs < 30000 &&
                  latest.executed 
                ) {
                   setPilotStatus("EXECUTING");
                   window.dispatchEvent(new CustomEvent("pilotOrderCreated"));
                   refetchHoldings();
                   
                   setTimeout(() => setPilotStatus("IDLE"), 3000);
                } else {
                   setPilotStatus("IDLE");
                }
              } else {
                setPilotStatus("IDLE");
              }
            } catch { 
              setPilotStatus("IDLE");
            }
          })
          .catch(() => {
            setPilotStatus("IDLE");
          });
      }
    }, 15000); // 15s polling for backend pilot execution trigger
    return () => clearInterval(id);
  }, [fetchSignal, config.auto_trade, refetchHoldings, getActiveTradingMode]);

  // Active triggers (Manual Load)
  useEffect(() => {
    fetchSignal(true);
  }, [interval, riskMode, activeSymbol, fetchSignal]);

  const saveConfig = useCallback(async (updates: Partial<BotConfig>, onSuccess?: () => void) => {
    // 1. Update LOCAL state immediately for UI responsiveness
    setConfig((prev) => {
      const next = { ...prev, ...updates };

      // Log changes only for MANUAL user actions via buttons, 
      // not for every internal state sync.
      return next;
    });

    // 2. Persist to BACKEND
    try {
      const res = await api.post("/bot/config", updates);
      if (res.data?.success) {
        if (onSuccess) onSuccess();
      } else {
        console.error("[MatrixHorizon] Config save failed:", res.data?.error);
      }
    } catch (err) {
      console.error("[MatrixHorizon] API Error during config save:", err);
      // Optional: Rollback local state on failure
    }
  }, []);

  const handlePanicSell = async () => {
    confirm({
      message: "TÜM POZİSYONLARI KAPATMAK İSTEDİĞİNİZDEN EMİN MİSİNİZ?",
      onConfirm: async () => {
        setIsActionLoading(true);
        console.log("[MatrixHorizon] Initiating Panic Sell request...");
        try {
          const res = await api.post("/panic/sell-all").then((r) => r.data);
          if (res.success) {
            notify(
              `PANİK SATIŞ TAMAMLANDI: ${res.results.length} varlık satıldı. Toplam: ${res.totalUsdtValue.toFixed(2)} USDT`,
              "success"
            );
            setIsPanicActive(true);
            logger.error(
              "🚨 PANİK SATIŞ TETİKLENDİ",
              `Kullanıcı manuel olarak ${res.results.length} işlemi sonlandırdı.`,
            );
            refetchHoldings();
          } else {
            notify(`Sistem Hatası: ${res.message || "Satış yapılamadı"}`, "error");
            logger.warn("⚠️ Panik Satış Başarısız", res.message);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("[MatrixHorizon] Panic Sell Error:", err);
          notify(`Bağlantı Hatası: ${errorMessage || "Sunucuya ulaşılamadı"}`, "error");
        }
        setIsActionLoading(false);
      }
    });
  };

  const handlePanicBuy = async () => {
    confirm({
      message: "PİYASAYA GERİ DÖNMEK İSTEDİĞİNİZDEN EMİN MİSİNİZ?",
      onConfirm: async () => {
        setIsActionLoading(true);
        console.log("[MatrixHorizon] Initiating Panic Buy request...");
        try {
          const res = await api.post("/panic/buy-back").then((r) => r.data);
          console.log("[MatrixHorizon] Panic Buy Response:", res);
          if (res.success) {
            notify(
              `PANİK ALIM (GERİ AL) TAMAMLANDI: ${res.results.length} varlık geri alındı. Harcanan: ${res.totalSpent.toFixed(2)} USDT`,
              "success"
            );
            setIsPanicActive(false);
            logger.success(
              "✅ PİYASAYA GERİ DÖNÜŞ",
              `Panik sonrası ${res.results.length} varlık tekrar satın alındı.`,
            );
            refetchHoldings();
          } else {
            notify(`Hata: ${res.message || "Alım yapılamadı"}`, "error");
            logger.warn("⚠️ Geri Alım Başarısız", res.message);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("[MatrixHorizon] Panic Buy Error:", err);
          notify(`Bağlantı Hatası: ${errorMessage || "Sunucuya ulaşılamadı"}`, "error");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
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

      {/* UNIFIED COMMAND BAR (Header) */}
      <CommandBar 
        aiSource={aiSource}
        setAiSource={setAiSource}
        selectedAsset={activeSymbol}
        socketOnline={socketOnline}
        interval={interval}
        liveBtcPrice={liveBtcPrice}
        prevLivePrice={prevLivePrice}
        microDigits={microDigits}
        config={config}
        saveConfig={saveConfig}
        pilotStatus={pilotStatus}
        isPanicActive={isPanicActive}
        isActionLoading={isActionLoading}
        handlePanicSell={handlePanicSell}
        handlePanicBuy={handlePanicBuy}
        runAiAnalysis={runAiAnalysis}
        aiLoading={aiLoading}
        isAdmin={isAdmin}
        aiCooldown={aiCooldown}
        aiResult={aiResult}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
      />

      {/* SETTINGS PANEL */}
      {showSettings && (
        <SettingsPanel 
          config={config}
          saveConfig={saveConfig}
          isAdmin={isAdmin}
          lastSync={lastSync}
          riskMode={riskMode}
          setRiskMode={setRiskMode}
        />
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
                upProb >= 60 || (signal?.prediction?.text || "").includes("YUKARI") || (signal?.prediction?.text || "").includes("📈")
                  ? "text-emerald-400"
                  : downProb >= 60 || (signal?.prediction?.text || "").includes("AŞAĞI") || (signal?.prediction?.text || "").includes("📉")
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
          </div>

          <div className="w-full max-w-[850px] mt-8 space-y-4 relative px-2 sm:px-4">
            {/* AI ANALYSIS SUMMARY (Dynamic) */}
            <div className="w-full mt-auto">
              <AIAnalysisSummary signal={signal} />
            </div>

            {/* Sync spinner shifted to AI Analysis box */}
            <div className="absolute -top-3 right-0 bg-slate-900/60 backdrop-blur-xl p-1.5 rounded-full border border-slate-700/50 shadow-lg">
               <RefreshCw
                 className={cn(
                   "w-3.5 h-3.5 text-cyan-500",
                   !lastSync && "animate-spin",
                 )}
               />
            </div>

            {/* COMPACT DECISION BAR (Daralt ve Ortalı) */}
            <div className="w-full mt-4 flex justify-center">
              <DecisionBar
                decision={
                  decisionText as "İŞLEM AÇ ✅" | "SATIŞ YAP 📉" | "BEKLE ❌"
                }
                aiSuggestion={signal?.prediction?.text || "ANALİZ EDİLİYOR..."}
                mode={signal?.marketPhaseText || "KONSOLİDASYON"}
                pilotStatus={pilotStatus}
                riskMode={riskMode}
                onRiskModeChange={(val) => {
                  setRiskMode(val);
                  localStorage.setItem("mx_riskMode", val);
                }}
              />
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
              label="Funding Rate"
              value={signal?.fundingRate !== undefined && signal.fundingRate !== null ? `${(signal.fundingRate * 100).toFixed(4)}%` : "---"}
              cls={
                (signal?.fundingRate ?? 0) > 0
                  ? "text-emerald-400"
                  : (signal?.fundingRate ?? 0) < 0
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
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
                        (signal?.vpa?.netPressure ?? 50) > 50
                          ? "good"
                          : (signal?.vpa?.netPressure ?? 50) < 50
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
                      m: "Volatilite & Sıkışma",
                      a: signal?.volatilityRegime === "SQUEEZE" ? "Sıkışma (Squeeze)" : "Normal",
                      y: signal?.volatilityRegime === "SQUEEZE" ? "Patlama Yakın" : "Sakin",
                      status:
                        signal?.volatilityRegime === "SQUEEZE"
                          ? "good"
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

        {/* ─── GROQ AI ŞEF SONUÇLARI (FULL WIDTH BOTTOM) ─── */}
        <div className="col-span-1 lg:col-span-12 w-full">
          {aiErr && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-400 text-[10px] font-mono">
              {aiErr}
            </div>
          )}

          {aiResult && aiVs ? (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mt-2">
              
              {/* Horizontal Top Section: Verdict + Reasoning */}
              <div className="flex flex-col xl:flex-row gap-3 w-full">
                {/* Verdict Badge - Wider horizontally */}
                <div
                  style={{ background: aiVs.bg, borderColor: aiVs.border }}
                  className="border-2 rounded-xl p-4 flex flex-col justify-center items-center relative min-w-[160px]"
                >
                  {aiResult.tf_noise_warning && <div className="absolute top-1.5 right-1.5 text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30">⚠️ Gürültü</div>}
                  <div className="text-4xl mb-1">{aiVs.icon}</div>
                  <div style={{ color: aiVs.text }} className="text-2xl font-black tracking-[0.15em]">{aiResult.verdict}</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase leading-tight">{aiResult.direction}<br/>{aiResult.urgency}</div>
                  <div className="w-full h-px bg-slate-700/50 my-2" />
                  <div className="flex justify-between w-full">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500">GÜVEN</div>
                      <div className={`text-lg font-black ${aiResult.confidence >= 70 ? "text-emerald-500" : aiResult.confidence >= 50 ? "text-amber-500" : "text-rose-500"}`}>%{aiResult.confidence}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500">POZİSYON</div>
                      <div style={{ color: AI_PSC[aiResult.position_size] || "#ef4444" }} className="text-lg font-black">{aiResult.position_size}</div>
                    </div>
                  </div>
                </div>

                {/* Şefin Detaylı Değerlendirmesi - Flex to fill rest of row */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 relative overflow-hidden flex-1 flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Brain className="w-24 h-24 text-violet-400" />
                  </div>
                  <h4 className="text-sm font-black text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                    🎼 Şefin Değerlendirmesi
                  </h4>
                  <p className="text-sm md:text-base font-medium text-slate-200 leading-relaxed italic pr-8">
                    &ldquo;{aiResult.reasoning}&rdquo;
                  </p>
                </div>
              </div>

              {/* Horizontal Bottom Section: On-Chain Raw Data (collapsible) */}
              {aiRaw && (
                <div className="space-y-1 w-full">
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3 w-full">
                    {[
                      { l: "RSI", v: aiRaw.momentum?.rsi, c: aiRaw.momentum?.rsi < 30 ? "text-emerald-400" : aiRaw.momentum?.rsi > 70 ? "text-rose-400" : "text-slate-400" },
                      { l: "Supertrend", v: aiRaw.trend?.supertrend, c: aiRaw.trend?.supertrendBull ? "text-emerald-400" : "text-rose-400" },
                      { l: "Balina", v: aiRaw.volume?.isWhale ? (aiRaw.volume?.whaleBuy ? "ALIYOR" : "SATIYOR") : "Nötr", c: aiRaw.volume?.whaleBuy ? "text-emerald-400" : aiRaw.volume?.whaleSell ? "text-rose-400" : "text-slate-400" },
                      { l: "BB", v: aiRaw.volatility?.bbSqueeze ? "SIKIŞMA" : "Normal", c: aiRaw.volatility?.bbSqueeze ? "text-amber-400" : "text-slate-400" },
                      { l: "F4 Gücü", v: aiRaw.dashboardState?.signal?.f4PowerLoss ? `${(100 - aiRaw.dashboardState.signal.f4PowerLoss).toFixed(0)}%` : "---", c: (aiRaw.dashboardState?.signal?.f4PowerLoss || 0) > 40 ? "text-rose-400" : "text-emerald-400" },
                      { l: "Capital", v: aiRaw.dashboardState?.signal?.capitalPhase || "---", c: aiRaw.dashboardState?.signal?.capitalPhase === "GİRİŞ" ? "text-emerald-400" : "text-rose-400" },
                      { l: "VPA Pressure", v: aiRaw.dashboardState?.signal?.vpa?.netPressure?.toFixed(1) || "---", c: (aiRaw.dashboardState?.signal?.vpa?.netPressure || 50) > 50 ? "text-emerald-400" : "text-rose-400" },
                      { l: "Likidite", v: aiRaw.dashboardState?.signal?.liquidityZone || "YOK", c: aiRaw.dashboardState?.signal?.liquidityZone?.includes("BOĞA") ? "text-emerald-400" : "text-rose-400" }
                    ].map(ch => (
                      <div key={ch.l} className="flex flex-col items-center justify-center p-3 bg-slate-950/40 border border-white/5 rounded-xl text-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase mb-1.5">{ch.l}</span>
                        <span className={`text-sm font-black ${ch.c}`}>{ch.v}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setAiShowRaw(d=>!d)} className="text-[10px] text-slate-600 hover:text-slate-300 w-full text-center pt-2 pb-1 transition-colors">
                    {aiShowRaw ? "▲ JSON Verisini Gizle" : "▼ Ham JSON Bağlamını İncele"}
                  </button>
                  {aiShowRaw && <pre className="text-xs font-mono text-slate-400 p-4 bg-black/80 border border-slate-700/50 rounded-xl max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(aiRaw, null, 2)}</pre>}
                </div>
              )}
            </div>
          ) : null}

          {/* AI ANALYSIS HISTORY (Legcy Parity) */}
          {aiHistory.length > 0 && (
            <div className="mt-4 animate-in fade-in duration-700">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1 h-3 bg-violet-500/50 rounded-full" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Karar Geçmişi
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300"
                  title={showHistory ? "Gizle" : "Göster"}
                >
                  {showHistory ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              {showHistory && (
                <div className="grid grid-cols-2 gap-2">
                  {aiHistory.map((h, i) => {
                    const hv = AI_VS[h.verdict] || AI_VS["BEKLE"];
                    return (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 bg-slate-900/40 border border-slate-800/50 rounded-lg flex items-center gap-3 transition-all hover:border-slate-700/50 w-full"
                      >
                        <span className="text-[9px] font-medium text-slate-600 font-mono italic">
                          {h.time}
                        </span>
                        <span className="text-[9px] font-black text-slate-400">
                          {h.symbol}/{h.tf}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{hv.icon}</span>
                          <span
                            className="text-[10px] font-black"
                            style={{ color: hv.text }}
                          >
                            {h.verdict}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500">
                          %{h.confidence}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- SUB-COMPONENTS ---

interface CommandBarProps {
  aiSource: string;
  setAiSource: (s: "ETH" | "ASSETS") => void;
  selectedAsset: string;
  socketOnline: boolean;
  interval: string;
  liveBtcPrice: number | null;
  prevLivePrice: number | null;
  microDigits: string;
  config: BotConfig;
  saveConfig: (updates: Partial<BotConfig>, cb?: () => void) => void;
  pilotStatus: string;
  isPanicActive: boolean;
  isActionLoading: boolean;
  handlePanicSell: () => void;
  handlePanicBuy: () => void;
  runAiAnalysis: () => void;
  aiLoading: boolean;
  isAdmin: boolean;
  aiCooldown: number;
  aiResult: any;
  showSettings: boolean;
  setShowSettings: (s: boolean) => void;
}

const CommandBar = ({
  aiSource, setAiSource, selectedAsset, socketOnline, interval,
  liveBtcPrice, prevLivePrice, microDigits, config, saveConfig,
  pilotStatus, isPanicActive, isActionLoading, handlePanicSell, handlePanicBuy,
  runAiAnalysis, aiLoading, isAdmin, aiCooldown, aiResult, showSettings, setShowSettings
}: CommandBarProps) => (
  <div className="relative z-20 flex flex-wrap items-center justify-center sm:justify-between py-2 px-2 gap-3 border-b border-slate-800/40 bg-slate-950/20 backdrop-blur-sm rounded-t-xl mb-2 font-mono">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-lg">
        <LayoutTemplate className="w-4 h-4 text-cyan-400" />
        <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden lg:block">Matrix Horizon</h2>
      </div>
      <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
        <button onClick={() => setAiSource("ETH")} className={cn("px-3 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all", aiSource === "ETH" ? "bg-cyan-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white")}>ETH</button>
        <button onClick={() => setAiSource("ASSETS")} className={cn("px-3 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all flex items-center gap-2", aiSource === "ASSETS" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white")}>
          <span>ÖZEL</span>
          <span className={cn("px-1.5 py-0.5 rounded bg-black/20 text-[8px]", aiSource === "ASSETS" ? "text-slate-900" : "text-emerald-400")}>{(selectedAsset || "BTCUSDT").replace('USDT', '').replace('/', '')}</span>
        </button>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
        <div className={cn("w-1.5 h-1.5 rounded-full", socketOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
        <span className={cn("text-[9px] font-black uppercase tracking-widest", socketOnline ? "text-emerald-400" : "text-rose-400")}>{socketOnline ? "ONLINE" : "OFFLINE"}</span>
        <div className="w-[1px] h-3 bg-slate-800 mx-1" />
        <span className="text-[9px] font-black text-cyan-400 tracking-widest">⏱{interval.toUpperCase()}</span>
      </div>
    </div>
    <div className="flex items-center px-4 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-inner min-w-[160px] justify-center">
      <div className="flex items-center gap-3">
        <AssetIcon symbol="BTC" size={20} className="drop-shadow-[0_0_8px_rgba(247,147,26,0.6)]" />
        <div className="flex items-baseline gap-1">
          <span className={cn("text-lg font-black tracking-tight", !liveBtcPrice ? "text-cyan-400" : (prevLivePrice && liveBtcPrice >= prevLivePrice ? "text-emerald-400" : "text-rose-400"))}>{liveBtcPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "00000.00"}</span>
          <span className="text-[10px] font-bold text-slate-600 font-mono tabular-nums leading-none mb-0.5">{microDigits}</span>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl gap-1">
        <button 
          onClick={() => { 
            const isActivating = !config.auto_trade;
            const mode = (typeof window !== "undefined" && localStorage.getItem("TRADING_MODE") === "production") ? "production" : "test"; 
            
            // Log manually on button click
            logger.success(
              isActivating ? "✈️ OTOMATİK PİLOT AKTİF" : "⏸ OTOMATİK PİLOT DEVRE DIŞI",
              `PİLOT durumu kullanıcı tarafından manuel olarak ${isActivating ? 'AÇILDI' : 'KAPATILDI'}.`
            );

            if (isActivating) { 
              // IMPORTANT: Don't overwrite pilot_timeframe with current UI interval.
              // Keep the previously set pilot_timeframe (from presets or DB).
              saveConfig({ auto_trade: true }, () => { 
                api.get(`/cron/strategies?immediate=true&tradingMode=${mode}`).catch(() => null); 
              }); 
            } else { 
              saveConfig({ auto_trade: false }); 
            } 
          }} 
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
            config.auto_trade ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
          )}
        >
          <Power className="w-3 h-3" />
          <span className="hidden sm:inline">PİLOT</span> 
          {config.auto_trade ? "ON" : "OFF"}
        </button>

        {/* PILOT STATUS & TIMEFRAME NOTIFICATION */}
        <div className="flex items-center gap-1">
          <div className={cn(
            "px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center min-w-[32px] shadow-lg shadow-cyan-500/5", 
            config.auto_trade ? (pilotStatus === "SCANNING" ? "text-cyan-400" : pilotStatus === "EXECUTING" ? "text-emerald-400" : "text-slate-600") : "text-slate-800"
          )}>
            {pilotStatus === "SCANNING" ? (
              <Activity className="w-3 h-3 animate-pulse" />
            ) : pilotStatus === "EXECUTING" ? (
              <Zap className="w-3 h-3 animate-bounce" />
            ) : (
              <Activity className="w-3 h-3 opacity-20" />
            )}
          </div>
          
          {config.auto_trade && (
            <div className="px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-black uppercase tracking-tighter animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.1)]">
              {(config.pilot_timeframe || "1M").toUpperCase()}
            </div>
          )}
        </div>
        <div className="w-[1px] h-4 bg-slate-800 mx-1" />
        <div className="flex items-center gap-1 px-1">
          <button onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), tradeMode: "Scalp" } })} className={cn("px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase transition-all", resolveTradeMode(config) === "Scalp" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "text-slate-500 hover:text-white")}>SCALP</button>
          <button onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), tradeMode: "Swing" } })} className={cn("px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase transition-all", resolveTradeMode(config) === "Swing" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40" : "text-slate-500 hover:text-white")}>SWING</button>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl gap-1">
        <button onClick={() => saveConfig({ defense_mode: !config.defense_mode })} className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", config.defense_mode ? "bg-cyan-500 text-slate-950" : "text-slate-500 hover:text-white")} title="Savunma Modu"><ShieldCheck className="w-3 h-3" /><span className="hidden xl:inline">SAVUNMA</span></button>
        <button disabled={isActionLoading} onClick={isPanicActive ? handlePanicBuy : handlePanicSell} className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", isPanicActive ? "text-emerald-500 hover:bg-emerald-500/10" : "text-rose-500 hover:bg-rose-500/10")} title={isPanicActive ? "Piyasaya Dön" : "Panik Satış"}>{isPanicActive ? <RefreshCw className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}<span className="hidden xl:inline">{isPanicActive ? "GERİ AL" : "PANİK SAT"}</span></button>
        <button onClick={runAiAnalysis} disabled={aiLoading || (!isAdmin && aiCooldown > 0)} className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", aiResult ? "bg-violet-500 text-white" : "text-violet-400 hover:bg-violet-500/10")} title="AI Analizi Çalıştır"><Brain className="w-3 h-3" /><span className="hidden xl:inline">ŞEF</span></button>
        <div className="w-[1px] h-4 bg-slate-800 mx-1" />
        <button onClick={() => setShowSettings(!showSettings)} className={cn("p-1.5 rounded-lg border transition-all", showSettings ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" : "border-slate-800 text-slate-500 hover:text-white")}><Settings className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  </div>
);

interface SettingsPanelProps {
  config: BotConfig;
  saveConfig: (updates: Partial<BotConfig>, cb?: () => void) => void;
  isAdmin: boolean;
  lastSync?: Date | null;
  riskMode: string;
  setRiskMode: (m: any) => void;
}

const TIMEFRAME_PRESETS = {
  "1M": { tp: 0.5, sl: 0.3, ttp: 0.1, tsl: 0.2 },
  "15M": { tp: 2.0, sl: 1.0, ttp: 0.3, tsl: 1.0 },
  "1H": { tp: 4.0, sl: 2.0, ttp: 0.5, tsl: 1.5 },
  "4H": { tp: 8.0, sl: 4.0, ttp: 1.0, tsl: 3.0 },
  "1D": { tp: 15.0, sl: 7.0, ttp: 2.0, tsl: 5.0 },
  "1W": { tp: 30.0, sl: 15.0, ttp: 3.0, tsl: 7.0 },
  "1MO": { tp: 60.0, sl: 30.0, ttp: 5.0, tsl: 10.0 },
};

const SettingsPanel = ({ config, saveConfig, isAdmin, lastSync, riskMode, setRiskMode }: SettingsPanelProps) => {
  const applyPreset = (tf: keyof typeof TIMEFRAME_PRESETS) => {
    const p = TIMEFRAME_PRESETS[tf];
    saveConfig({
      pilot_timeframe: tf.toLowerCase(),
      pilot_tp_deviation: p.ttp,
      pilot_sl_deviation: p.tsl,
      pilot_tp_trailing: true,
      timeframe_settings: {
        ...(config.timeframe_settings || {}),
        pilot_tp_percent: p.tp,
        pilot_sl_percent: p.sl,
        pilot_sl_trailing: true,
        pilot_sl_deviation: p.tsl,
        cover_tp_percent: p.tp,
        cover_sl_percent: p.sl,
        cover_tp_trailing: true,
        cover_tp_deviation: p.ttp,
        cover_sl_trailing: true,
        cover_sl_deviation: p.tsl,
      }
    });
    logger.success(`🚀 ${tf} PRESET UYGULANDI`, `Zaman dilimine göre tüm parametreler oransal olarak güncellendi.`);
  };

  return (
    <div className="relative z-30 bg-slate-950/90 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-top-4 duration-300 mb-2">
      <div className="lg:col-span-3 space-y-4 flex flex-col">
        <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest mb-1 pb-2 border-b border-white/5"><Zap className="w-4 h-4 text-cyan-400" /> SİSTEM KONTROL</div>
        <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400/60 uppercase tracking-widest bg-cyan-500/5 p-2 rounded-lg border border-cyan-500/10"><Zap className="w-3 h-3 animate-pulse" /> OTONOM PARAMETRE: AKTİF</div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-[10px] text-slate-400 font-mono leading-relaxed flex-1 shadow-inner relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-all duration-500" /><span className="text-cyan-400 font-bold block mb-2 uppercase text-[9px] tracking-widest flex items-center gap-2"><Activity size={10} /> ENGINE CONSOLE</span>
          <div className="space-y-1 opacity-80"><div>{">"} Matrix Smart Engine Ready</div><div>{">"} Mode: {resolveTradeMode(config).toUpperCase()}</div><div>{">"} Defense: {config.defense_mode ? "REINFORCED" : "STANDARD"}</div></div>
        </div>
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><div className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1"><ShieldCheck className="w-3 h-3" /> CANLI SENKRONİZASYON</div></div>
      </div>
      <div className="lg:col-span-3 space-y-4 px-2 border-l border-white/5">
        <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest pb-2 border-b border-white/10"><Power className="w-4 h-4" /> GENEL PARAMETRELER</div>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gecikmeli Alım</span><button onClick={() => saveConfig({ pilot_trailing_buy: !config.pilot_trailing_buy })} className={cn("px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all shadow-sm", config.pilot_trailing_buy ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-950 text-slate-600 border border-slate-800")}>{config.pilot_trailing_buy ? "AKTİF" : "PASİF"}</button></div>
          <div className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portföyü Tara</span><button onClick={() => saveConfig({ pilot_only_holdings: !(config.pilot_only_holdings ?? DEFAULT_BOT_CONFIG.pilot_only_holdings) })} className={cn("px-2.5 py-1 rounded text-[9px] font-black uppercase transition-all shadow-sm", (config.pilot_only_holdings ?? DEFAULT_BOT_CONFIG.pilot_only_holdings) ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-slate-950 text-slate-600 border border-slate-800")}>{(config.pilot_only_holdings ?? DEFAULT_BOT_CONFIG.pilot_only_holdings) ? "AKTİF" : "PASİF"}</button></div>
          <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5"><div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><span>İşlem Büyüklüğü</span><span className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{((config.timeframe_settings as any)?.pilot_trade_allocation || 10)}%</span></div><input type="range" min="5" max="100" step="5" value={(config.timeframe_settings as any)?.pilot_trade_allocation || 10} onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_trade_allocation: parseInt(e.target.value) } })} className="w-full h-1.5 accent-cyan-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" /></div>
        </div>

        {/* TIMEFRAME PRESETS INLINED UNDER GENERAL PARAMS */}
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-black text-cyan-200 uppercase tracking-widest">Zaman Dilimi Hazır Ayarı</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(Object.keys(TIMEFRAME_PRESETS) as Array<keyof typeof TIMEFRAME_PRESETS>).map((tf) => (
              <button
                key={tf}
                onClick={() => applyPreset(tf)}
                className={cn(
                  "py-2 bg-slate-950/40 border rounded transition-all duration-300 text-[9px] font-black tracking-tighter",
                  config.pilot_timeframe === tf.toLowerCase() 
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]" 
                    : "border-slate-800 text-slate-600 hover:border-cyan-500/30 hover:text-cyan-300"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3 space-y-4 px-2 border-l border-white/5">
        <div className="flex items-center gap-2 text-xs font-black text-emerald-500 uppercase tracking-widest pb-2 border-b border-white/10">📈 TRADE (LONG)</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2 border border-emerald-500/20 bg-emerald-500/5 p-2 rounded-lg shadow-inner shadow-emerald-500/5"><div className="flex justify-between items-center bg-slate-950/50 rounded p-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sabit TP</span><span className="text-[10px] font-black text-emerald-400">{config.timeframe_settings?.pilot_tp_percent || DEFAULT_BOT_CONFIG.timeframe_settings.pilot_tp_percent}%</span></div><input type="range" min="0.5" max="50.0" step="0.1" value={config.timeframe_settings?.pilot_tp_percent || DEFAULT_BOT_CONFIG.timeframe_settings.pilot_tp_percent} onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_tp_percent: parseFloat(e.target.value) } })} className="w-full h-1 accent-emerald-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" /></div>
            <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-2 rounded-lg shadow-inner shadow-rose-500/5"><div className="flex justify-between items-center bg-slate-950/50 rounded p-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sabit SL</span><span className="text-[10px] font-black text-rose-400">{config.timeframe_settings?.pilot_sl_percent || DEFAULT_BOT_CONFIG.timeframe_settings.pilot_sl_percent}%</span></div><input type="range" min="0.5" max="30.0" step="0.1" value={config.timeframe_settings?.pilot_sl_percent || DEFAULT_BOT_CONFIG.timeframe_settings.pilot_sl_percent} onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_sl_percent: parseFloat(e.target.value) } })} className="w-full h-1 accent-rose-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" /></div>
          </div>
          <div className="space-y-2 border border-emerald-500/20 bg-emerald-500/5 p-2.5 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-400 uppercase">TTP — İz Kâr Al</span>
                <span className="text-[8px] text-slate-500">TP'ye ulaşınca aktif, TP'yi izler ↑</span>
              </div>
              <button 
                onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_tp_trailing: !((config.timeframe_settings as any)?.pilot_tp_trailing ?? config.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing) } })} 
                className={cn("px-2 py-0.5 text-[8px] font-bold rounded transition-all", ((config.timeframe_settings as any)?.pilot_tp_trailing ?? config.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing) ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-500")}
              >
                {((config.timeframe_settings as any)?.pilot_tp_trailing ?? config.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing) ? "AÇIK" : "KAPALI"}
              </button>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-500 bg-slate-950/50 p-1 rounded">
              <span>Sapma (Dev)</span>
              <span className="text-emerald-400">{((config.timeframe_settings as any)?.pilot_tp_deviation ?? config.pilot_tp_deviation ?? DEFAULT_BOT_CONFIG.pilot_tp_deviation)}%</span>
            </div>
            <input type="range" min="0.1" max="10.0" step="0.1" 
              value={((config.timeframe_settings as any)?.pilot_tp_deviation ?? config.pilot_tp_deviation ?? DEFAULT_BOT_CONFIG.pilot_tp_deviation)} 
              onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_tp_deviation: parseFloat(e.target.value) } })} 
              className="w-full h-1 accent-emerald-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>
          <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-2.5 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-400 uppercase">TSL — İz Zarar Kes</span>
                <span className="text-[8px] text-slate-500">TP tetiklenince aktif, SL'yi yukarı taşır ↑</span>
              </div>
              <button 
                onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_sl_trailing: !((config.timeframe_settings as any)?.pilot_sl_trailing ?? config.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing) } })} 
                className={cn("px-2 py-0.5 text-[8px] font-bold rounded transition-all", ((config.timeframe_settings as any)?.pilot_sl_trailing ?? config.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing) ? "bg-rose-400 text-slate-950" : "bg-slate-800 text-slate-500")}
              >
                {((config.timeframe_settings as any)?.pilot_sl_trailing ?? config.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing) ? "AÇIK" : "KAPALI"}
              </button>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-500 bg-slate-950/50 p-1 rounded">
              <span>Sapma (Dev)</span>
              <span className="text-rose-400">{((config.timeframe_settings as any)?.pilot_sl_deviation ?? config.pilot_sl_deviation ?? DEFAULT_BOT_CONFIG.pilot_sl_deviation)}%</span>
            </div>
            <input type="range" min="0.1" max="10.0" step="0.1" 
              value={((config.timeframe_settings as any)?.pilot_sl_deviation ?? config.pilot_sl_deviation ?? DEFAULT_BOT_CONFIG.pilot_sl_deviation)} 
              onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), pilot_sl_deviation: parseFloat(e.target.value) } })} 
              className="w-full h-1 accent-rose-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>
        </div>
      </div>
      <div className="lg:col-span-3 space-y-4 px-2 border-l border-white/5">
        <div className="flex items-center gap-2 text-xs font-black text-purple-400 uppercase tracking-widest pb-2 border-b border-white/10">📉 COVER (SHORT)</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2 border border-purple-500/20 bg-purple-500/5 p-2 rounded-lg shadow-inner shadow-purple-500/5"><div className="flex justify-between items-center bg-slate-950/50 rounded p-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Geri Alım (TP)</span><span className="text-[10px] font-black text-purple-400">{config.timeframe_settings?.cover_tp_percent || DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_percent}%</span></div><input type="range" min="0.5" max="50.0" step="0.1" value={config.timeframe_settings?.cover_tp_percent || DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_percent} onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_tp_percent: parseFloat(e.target.value) } })} className="w-full h-1 accent-purple-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" /></div>
            <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-2 rounded-lg shadow-inner shadow-rose-500/5"><div className="flex justify-between items-center bg-slate-950/50 rounded p-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aşım (SL)</span><span className="text-[10px] font-black text-rose-400">{config.timeframe_settings?.cover_sl_percent || DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_percent}%</span></div><input type="range" min="0.1" max="30.0" step="0.1" value={config.timeframe_settings?.cover_sl_percent || DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_percent} onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_sl_percent: parseFloat(e.target.value) } })} className="w-full h-1 accent-rose-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" /></div>
          </div>
          <div className="space-y-2 border border-purple-500/20 bg-purple-500/5 p-2.5 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-purple-400 uppercase">TTP — İz Geri Alım</span>
                <span className="text-[8px] text-slate-500">TP'ye düşince aktif, geri alımı aşağı izler ↓</span>
              </div>
              <button
                onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_tp_trailing: !((config.timeframe_settings as any)?.cover_tp_trailing ?? config.timeframe_settings?.cover_tp_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_trailing) } })}
                className={cn("px-2 py-0.5 text-[8px] font-bold rounded transition-all", ((config.timeframe_settings as any)?.cover_tp_trailing ?? config.timeframe_settings?.cover_tp_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_trailing) ? "bg-purple-400 text-slate-950" : "bg-slate-800 text-slate-500")}
              >
                {((config.timeframe_settings as any)?.cover_tp_trailing ?? config.timeframe_settings?.cover_tp_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_trailing) ? "AÇIK" : "KAPALI"}
              </button>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-500 bg-slate-950/50 p-1 rounded">
              <span>Sapma (Dev)</span>
              <span className="text-purple-400">{((config.timeframe_settings as any)?.cover_tp_deviation ?? config.timeframe_settings?.cover_tp_deviation ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_deviation)}%</span>
            </div>
            <input type="range" min="0.1" max="10.0" step="0.1"
              value={(config.timeframe_settings as any)?.cover_tp_deviation || DEFAULT_BOT_CONFIG.timeframe_settings.cover_tp_deviation}
              onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_tp_deviation: parseFloat(e.target.value) } })}
              className="w-full h-1 accent-purple-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>
          <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-2.5 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-400 uppercase">TSL — İz Zarar Kes</span>
                <span className="text-[8px] text-slate-500">TP geçilince aktif, SL'yi aşağı taşır ↓</span>
              </div>
              <button
                onClick={() => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_sl_trailing: !((config.timeframe_settings as any)?.cover_sl_trailing ?? config.timeframe_settings?.cover_sl_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_trailing) } })}
                className={cn("px-2 py-0.5 text-[8px] font-bold rounded transition-all", ((config.timeframe_settings as any)?.cover_sl_trailing ?? config.timeframe_settings?.cover_sl_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_trailing) ? "bg-rose-400 text-slate-950" : "bg-slate-800 text-slate-500")}
              >
                {((config.timeframe_settings as any)?.cover_sl_trailing ?? config.timeframe_settings?.cover_sl_trailing ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_trailing) ? "AÇIK" : "KAPALI"}
              </button>
            </div>
            <div className="flex justify-between text-[9px] font-bold text-slate-500 bg-slate-950/50 p-1 rounded">
              <span>Sapma (Dev)</span>
              <span className="text-rose-400">{((config.timeframe_settings as any)?.cover_sl_deviation ?? config.timeframe_settings?.cover_sl_deviation ?? DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_deviation)}%</span>
            </div>
            <input type="range" min="0.1" max="10.0" step="0.1"
              value={(config.timeframe_settings as any)?.cover_sl_deviation || DEFAULT_BOT_CONFIG.timeframe_settings.cover_sl_deviation}
              onChange={(e) => saveConfig({ timeframe_settings: { ...(config.timeframe_settings || {}), cover_sl_deviation: parseFloat(e.target.value) } })}
              className="w-full h-1 accent-rose-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
};
