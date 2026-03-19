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
  Settings2,
  Coins,
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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Target,
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
  pilot_mode?: 'matrix' | 'hedge';
  pilot_use_usdt?: boolean;
  fibo_length: number;
  f4_power_loss_threshold: number; // F4 Güç Kaybı Eşiği
  f4_lookback_bars?: number;
  f4_squeeze_threshold?: number;
  min_power_loss?: number;
  scalp_length?: number;
  scalp_volume_multiplier?: number;
  swing_length?: number;
  swing_volume_multiplier?: number;
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
function sanitizeSignalData(r1: any, currentPrice?: number | null): any {
  if (!r1) return null;
  
  // MatrixV5Engine tüm verileri %100 profesyonel ve formülasyona dayalı hesaplar.
  // Asla sahte veri, fallback veya varsayılan değer üretme!
  
  // Hedefler (Targets) motor tarafından dinamik ATR/Fibonacci projeksiyonu ile üretilir.
  if (r1.targets) {
    r1._derivedTarget = r1.targets.t1 || r1.targets.t2 || r1.currentPrice || currentPrice || 0;
  }

  return r1;
}

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

const txtC = (c: string) => {
  const map: Record<string, string> = {
    green: "text-emerald-400",
    red: "text-rose-400",
    orange: "text-amber-400",
    gray: "text-slate-400",
  };
  return map[c] || "text-slate-400";
};

const brdC = (c: string) => {
  const map: Record<string, string> = {
    green: "border-emerald-500/30 bg-emerald-500/5",
    red: "border-rose-500/30 bg-rose-500/5",
    orange: "border-amber-500/30 bg-amber-500/5",
    gray: "border-slate-700/50 bg-slate-800/20",
  };
  return map[c] || "border-slate-700/50 bg-slate-800/20";
};

const MiniBar = ({
  value,
  color = "bg-cyan-500",
  label,
  min = 0,
  max = 100,
}: {
  value: number;
  color?: string;
  label?: string;
  min?: number;
  max?: number;
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
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
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

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

export const MatrixHorizon = ({ 
  isManaged = false,
  signalDataMap,
}: { 
  isManaged?: boolean;
  signalDataMap?: Record<string, any>;
}) => {
  const { refetch: refetchHoldings } = useHoldings();
  const { timeframe: interval } = useTimeframe();
  const { notify, confirm } = useNotification();
  const [signal, setSignal] = useState<V5Signal | null>(null);
  const [btcDom, setBtcDom] = useState(55.4);
  const [usdtDom, setUsdtDom] = useState(4.2);
  const [othersDom, setOthersDom] = useState(11.8);
  const [marketFlow, setMarketFlow] = useState({ label: "ROTASYON 🔄", color: "text-cyan-400" });

  // Fetch real market dominance data on mount
  useEffect(() => {
    fetchGlobalMarketData().then((data) => {
      if (data) {
        setBtcDom(data.btcd.value);
        setUsdtDom(data.usdtd.value);
        setOthersDom(data.othersd.value);
        setMarketFlow({ label: data.flow, color: data.flowColor });
      }
    }).catch(err => {
      console.warn("[MatrixHorizon] Failed to fetch dominance:", err);
    });
  }, []);


  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [socketOnline, setSocketOnline] = useState(true);
  const [riskMode, setRiskMode] = useState<"safe" | "normal" | "aggressive">(
    () => (typeof window !== "undefined" ? (localStorage.getItem("mx_riskMode") as "safe" | "normal" | "aggressive" | null) ?? "aggressive" : "aggressive"),
  );

  // Command State
  const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);

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

  const { symbol: selectedAsset, setSymbol } = useTrade();
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
  const [showHistory, setShowHistory] = useState(false);

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
    console.log("[MatrixHorizon] runAiAnalysis triggered", { activeSymbol, interval, isAdmin, aiCooldown });
    if (!isAdmin && aiCooldown > 0) {
      console.warn("[MatrixHorizon] AI Analysis rate limited locally", { aiCooldown });
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
            `/indicators/f4?symbol=${activeSymbol}&interval=${interval}&riskMode=${riskMode}${sentiment ? `&sentiment=${sentiment.score}` : ""}&btcDom=${btcDom}&usdtDom=${usdtDom}`,
          ),
          fetchGlobalMarketData().catch(() => null),
        ]);
        const r1 = sanitizeSignalData(res.data, currentPrice);
        if (r1 && !r1.error) {
          setSignal(r1);
          if (r1.prediction) {
            setPrediction({
              predictedPrice: r1._derivedTarget,
              trend: r1.prediction.direction ?? "FLAT",
              confidence: r1.confluenceScore ?? 75,
            });
          }
        }
        if (mkt) {
          setBtcDom(mkt.btcd?.value || btcDom || 58.4);
          setUsdtDom(mkt.usdtd?.value || usdtDom || 4.2);
        }
        setLastSync(new Date());
      } catch {
        setSocketOnline(false);
      } finally {
        if (isManual) setIsActionLoading(false);
      }
    },
    [interval, riskMode, activeSymbol], // Removed sentiment score and btc/usdt dom to break loop
  );

  // Expose fetchSignal to window so CommandBar can trigger full refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any)._mx_fetchSignal = fetchSignal;
    }
  }, [fetchSignal]);

  // Periodical background refresh (Market analysis & Cron trigger)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isManaged) return;

      fetchSignal(false);

      if (config.auto_trade) {
        const tradingMode = getActiveTradingMode();
        setPilotStatus("SCANNING");
        
        api.get(`/cron/strategies?immediate=true&tradingMode=${tradingMode}`)
          .then(async () => {
            try {
              const signalsRes = await api.get(`/trade/signals?limit=5&tradingMode=${tradingMode}`);
              if (signalsRes.data && signalsRes.data.length > 0) {
                const latest = signalsRes.data[0];
                const signalTimeMs = Number(latest.timestamp);
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
    }, 60000); // 60s - Optimized for Northflank external cron
    return () => clearInterval(id);
  }, [fetchSignal, config.auto_trade, refetchHoldings, getActiveTradingMode, isManaged]);

  // Active triggers (Manual Load & Management)
  useEffect(() => {
     if (isManaged && signalDataMap) {
        const raw = signalDataMap[activeSymbol.replace("/", "")];
        const data = sanitizeSignalData(raw, currentPrice);
        if (data) {
          setSignal(data);
          if (data.prediction) {
             setPrediction({
               predictedPrice: data._derivedTarget || data.currentPrice || 0,
               trend: data.prediction.direction ?? "FLAT",
               confidence: data.confluenceScore ?? 75,
             });
          }
          setLastSync(new Date());
        }
        return;
     }
    
    // Independent mode (only if not managed)
    fetchSignal(true);
  }, [interval, riskMode, activeSymbol, fetchSignal, isManaged, signalDataMap]);

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
    <div className={cn(
      "w-full px-2 py-0 transition-all duration-500 relative",
      isSectionExpanded 
        ? "bg-transparent min-h-[600px] flex flex-col gap-0 overflow-hidden" 
        : "bg-transparent min-h-0"
    )}>
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
        setSymbol={setSymbol}
        socketOnline={socketOnline}
        interval={interval}
        liveBtcPrice={liveBtcPrice}
        currentPrice={currentPrice}
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
        authUser={authUser}
        isSectionExpanded={isSectionExpanded}
        setIsSectionExpanded={setIsSectionExpanded}
      />

      {/* SETTINGS PANEL */}
      {showSettings && isSectionExpanded && (
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
      <div className={cn(
        "flex-1 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 transition-all duration-500 overflow-hidden items-stretch",


        isSectionExpanded ? "max-h-[5000px] opacity-100 py-0" : "max-h-0 opacity-0 py-0"
      )}>
        {/* ── LEFT WING: INTELLIGENCE & STRUCTURE ── */}
        <div className="col-span-1 lg:col-span-4 grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">

          {/* SECTION 1: AI CONFLUENCE (No redundant score) */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-2">
            <SH
              icon={<Brain size={11} />}
              title="AI Güven Analizi"
              color="text-cyan-400"
            />
            <div className="grid grid-cols-2 gap-2 py-1">
              <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-center">
                <div className="text-[9px] text-slate-500 uppercase font-black mb-1">
                  YUKARI POT.
                </div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  {upProb.toFixed(0)}%
                </div>
              </div>
              <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded text-center">
                <div className="text-[9px] text-slate-500 uppercase font-black mb-1">
                  AŞAĞI POT.
                </div>
                <div className="text-base font-black text-rose-400 font-mono">
                  {downProb.toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-white/5 mt-1">
              <Row
                label="Tahmin"
                value={signal?.prediction?.text || "YATAY"}
                cls={
                  upProb >= 60 || (signal?.prediction?.text || "").includes("YUKARI") || (signal?.prediction?.text || "").includes("📈")
                    ? "text-emerald-400"
                    : downProb >= 60 || (signal?.prediction?.text || "").includes("AŞAĞI") || (signal?.prediction?.text || "").includes("📉")
                      ? "text-rose-400"
                      : "text-slate-400"
                }
              />
              <Row
                label="Market Fazı"
                value={signal?.marketPhaseText || "YATAY"}
                cls="text-amber-400"
              />
              
              <div className="space-y-3 pt-2 mt-1 border-t border-white/5">
                <MiniBar
                  value={signal?.confluenceBreakdown?.momentumScore || 0}
                  color="bg-violet-500"
                  label="İVME DURUMU"
                />
                <MiniBar
                  value={signal?.confluenceBreakdown?.trendScore || 0}
                  color="bg-emerald-500"
                  label="TREND GÜCÜ"
                />
                <MiniBar
                  value={signal?.confluenceBreakdown?.volumeScore || 0}
                  color="bg-amber-500"
                  label="HACİM KALİTESİ"
                />
              </div>
            </div>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
              {(signal?.v5Indicators ?? []).map((ind, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded border text-center gap-1",
                    brdC(ind.color)
                  )}
                  title={`${ind.name}: ${ind.value}`}
                >
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">
                    {ind.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-tight",
                      txtC(ind.color)
                    )}
                  >
                    {ind.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: THE ENGINE EYE ── */}
        <div
          className={cn(
            "col-span-1 lg:col-span-4 flex flex-col items-center justify-between relative min-h-[500px] transition-opacity duration-300 h-full",
            isActionLoading ? "opacity-40 animate-pulse" : "opacity-100",
          )}
        >

          <div className="relative flex-shrink-0 flex flex-col items-center justify-center mt-4">


            <CentralCommand
              score={score}
            />
          </div>

          <div className="w-full max-w-[850px] -mt-8 space-y-4 relative px-2 sm:px-4">
            {/* CONSOLIDATED INFORMATION SATELLITE (Moved from CentralCommand - Original Horizontal Style) */}
            <div className="w-full flex justify-center mb-2">
              <div className="inline-flex items-center gap-5 bg-slate-900/90 border-2 border-slate-800 px-7 py-3 rounded-full backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-300">
                <div
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
                    score >= 65 ? "text-emerald-400" : score < 50 ? "text-rose-400" : "text-slate-400"
                  )}
                >
                  {signal?.whaleSignalText || (signal?.whaleDetected ? "BALİNA GİRİŞİ 🐳" : "NORMAL AKIŞ")}
                </div>
                
                <div className="w-[1px] h-6 bg-slate-800" />
                
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">TAHMİN:</span>
                  <span className={cn(
                    "text-xl font-mono font-black tracking-tighter transition-colors duration-500",
                    (signal?.prediction?.text || "").includes("YUKARI") || (signal?.prediction?.text || "").includes("📈") ? "text-emerald-400" :
                    (signal?.prediction?.text || "").includes("AŞAĞI") || (signal?.prediction?.text || "").includes("📉") ? "text-rose-400" :
                    "text-white"
                  )}>
                    {signal?.prediction?.text || (prediction?.trend === "UP" ? "YUKARI 📈" : prediction?.trend === "DOWN" ? "AŞAĞI 📉" : "ANALİZ...")}
                  </span>
                </div>
              </div>
            </div>

              <div className="w-full">
                <AIAnalysisSummary signal={signal} riskMode={riskMode} />
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
        <div className="col-span-1 lg:col-span-4 grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">

          {/* SECTION 4: MARKET DYNAMICS */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg p-3 space-y-2">
            <SH
              icon={<Globe size={11} />}
              title="Piyasa Dinamiği"
              color="text-blue-400"
            />
            {[
              { label: "BTC HAKİMİYET", val: btcDom, color: "bg-amber-500", min: 40, max: 70 },
              { label: "USDT REZERV", val: usdtDom, color: "bg-cyan-500", min: 4, max: 10 },
            ].map(({ label, val, color, min, max }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold uppercase tracking-tighter">
                    {label}
                  </span>
                  <span className="font-mono font-bold text-slate-300">
                    {val.toFixed(1)}%
                  </span>
                </div>
                <MiniBar value={val} color={color} min={min} max={max} />
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
                          {h.symbol.replace('/USDT', '').replace('USDT', '')}/{h.tf}
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

          {/* ─── MONEY FLOW RECOGNITION (Final Polish) ─── */}
          <div className="col-span-1 lg:col-span-12 mt-8 py-3 bg-slate-900/40 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 px-6 rounded-b-xl border-x border-b border-white/5">
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
              <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] shrink-0">MONEY_FLOW::CORE</span>
              
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 group cursor-help" title="Bitcoin Dominance Indicator">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", btcDom > 55 ? "text-amber-400" : "text-slate-500")}>BITCOIN</span>
                  <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded">{btcDom.toFixed(1)}%</span>
                </div>
                
                <div className="flex items-center gap-2 group cursor-help" title="Altcoin Market Share">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", othersDom > 12 ? "text-emerald-400" : "text-slate-500")}>ALTCOIN</span>
                  <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded">{othersDom.toFixed(1)}%</span>
                </div>

                <div className="flex items-center gap-2 group cursor-help" title="Safe Haven / Global Risk Proxy">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", usdtDom > 5 ? "text-blue-400" : "text-slate-500")}>GOLD/XAU</span>
                  <span className="text-[11px] font-mono font-bold text-slate-100 bg-slate-800/50 px-1.5 py-0.5 rounded">VARLIK</span>
                </div>

                <div className="flex items-center gap-2 group cursor-help" title="USDT / Stablecoin Dominance">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider transition-colors", usdtDom > 6 ? "text-rose-400" : "text-slate-500")}>FIAT/USD</span>
                  <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded">{usdtDom.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className={cn("px-4 py-1.5 rounded-full bg-slate-950 border border-white/10 text-[10px] font-black uppercase tracking-[0.15em] shadow-xl", marketFlow.color)}>
              {marketFlow.label}
            </div>
          </div>
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
  setSymbol: (s: string) => void;
  socketOnline: boolean;
  interval: string;
  liveBtcPrice: number | null;
  currentPrice: number | null;
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
  authUser: any;
  isSectionExpanded: boolean;
  setIsSectionExpanded: (expanded: boolean) => void;
}

const CommandBar = ({
  aiSource, setAiSource, selectedAsset, setSymbol, socketOnline, interval,
  liveBtcPrice, currentPrice, prevLivePrice, microDigits, config, saveConfig,
  pilotStatus, isPanicActive, isActionLoading, handlePanicSell, handlePanicBuy,
  runAiAnalysis, aiLoading, isAdmin, aiCooldown, aiResult, showSettings, setShowSettings, authUser,
  isSectionExpanded, setIsSectionExpanded
}: CommandBarProps) => {
  const { data: holdingsRaw } = useHoldings();
  const holdings = holdingsRaw || [];
  const { setTimeframe } = useTimeframe();
  const assetScrollRef = React.useRef<HTMLDivElement>(null);

  const startScroll = (dir: "left" | "right") => {
    if (assetScrollRef.current) {
      const scrollAmount = dir === "left" ? -200 : 200;
      assetScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div 
      className={cn(
        "relative z-20 flex flex-col lg:flex-row items-center justify-between py-2 px-0 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 active:scale-100 transition-colors backdrop-blur-sm font-mono cursor-pointer select-none",
        isSectionExpanded ? "mb-0" : "mb-0"
      )}
      onClick={() => setIsSectionExpanded(!isSectionExpanded)}
    >
      {/* GROUP 1: SECTION TITLE & ASSETS */}
      <div className="flex-1 flex items-center gap-2 min-w-0 w-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-transparent shrink-0">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden xl:block">
            MATRIX SMART
          </h2>
        </div>

        {/* PRICE BOX - Integrated for Active Asset */}
        <div className="hidden md:flex items-center px-3 py-1 bg-slate-950/20 shrink-0">
          <div className="flex items-center gap-2">
            <AssetIcon symbol={selectedAsset?.split('/')[0] || "BTC"} size={16} className="drop-shadow-[0_0_8px_rgba(247,147,26,0.6)]" />
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-xs font-black tracking-tight", 
                !currentPrice ? "text-cyan-400" : (prevLivePrice && currentPrice >= prevLivePrice ? "text-emerald-400" : "text-rose-400")
              )}>
                {currentPrice?.toLocaleString(undefined, { 
                  minimumFractionDigits: currentPrice && currentPrice < 1 ? 4 : 2, 
                  maximumFractionDigits: currentPrice && currentPrice < 1 ? 4 : 2 
                }) || "0.00"}
              </span>
              <span className="text-[8px] font-bold text-slate-600 font-mono tabular-nums">{microDigits}</span>
            </div>
          </div>
        </div>

        {/* ASSET SCROLLER */}
        <div className="flex-1 flex items-center gap-1 relative group/scroll-container overflow-hidden min-w-0 max-w-[800px]">
          <div 
            onClick={(e) => { e.stopPropagation(); startScroll("left"); }}
            className="absolute left-0 top-0 bottom-0 w-8 z-40 flex items-center justify-start bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent cursor-pointer opacity-0 group-hover/scroll-container:opacity-100 transition-opacity"
          >
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center backdrop-blur-sm hover:bg-cyan-500/20 transition-colors">
              <ChevronLeft className="w-3 h-3 text-cyan-400" />
            </div>
          </div>
          
          <div 
            ref={assetScrollRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-8 py-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1 bg-slate-950/40 border border-slate-800/50 rounded-lg p-0.5 mr-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setAiSource("ETH"); }} 
                className={cn(
                  "px-2 py-0.5 text-[8px] font-black tracking-widest uppercase rounded transition-all", 
                  aiSource === "ETH" ? "bg-cyan-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"
                )}
              >
                ETH
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setAiSource("ASSETS"); }} 
                className={cn(
                  "px-2 py-0.5 text-[8px] font-black tracking-widest uppercase rounded transition-all", 
                  aiSource === "ASSETS" ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"
                )}
              >
                ASSET
              </button>
            </div>

            {holdings.filter(h => {
              const sym = h.symbol.split('/')[0].trim().toUpperCase();
              return sym !== 'USDT' && sym !== 'USD' && sym !== '';
            }).map((asset) => (
              <button 
                key={asset.id} 
                onClick={(e) => { 
                  e.stopPropagation();
                  setSymbol(asset.symbol + "/USDT");
                  setAiSource("ASSETS");
                }} 
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all relative group h-[26px] min-w-fit flex-shrink-0 z-30", 
                  selectedAsset.includes(asset.symbol) ? "bg-cyan-500/20 border-cyan-500/50" : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/50"
                )}
              >
                <AssetIcon symbol={asset.symbol} size={14} />
                <span className="text-[9px] font-black text-white leading-none">{asset.symbol}</span>
              </button>
            ))}
          </div>

          <div 
            onClick={(e) => { e.stopPropagation(); startScroll("right"); }}
            className="absolute right-0 top-0 bottom-0 w-8 z-40 flex items-center justify-end bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent cursor-pointer opacity-0 group-hover/scroll-container:opacity-100 transition-opacity"
          >
            <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center backdrop-blur-sm hover:bg-cyan-500/20 transition-colors">
              <ChevronRight className="w-3 h-3 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* GROUP 3: TIMEFRAMES & COMMAND ACTIONS */}
      <div className="flex items-center gap-2 lg:gap-4 shrink-0 justify-between w-full lg:w-auto overflow-x-auto no-scrollbar">
        {/* Timeframes moved here from center */}
        <div className="flex items-center p-1 bg-slate-950/20 gap-1">

          <button 
            onClick={(e) => { 
              e.stopPropagation();
              saveConfig({ defense_mode: !config.defense_mode });
            }} 
            className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", config.defense_mode ? "bg-cyan-500 text-slate-950" : "text-slate-500 hover:text-white")} 
            title="Savunma Modu"
          >
            <ShieldCheck className="w-3 h-3" />
            <span className="hidden xl:inline">SAVUNMA</span>
          </button>

          <button 
            disabled={isActionLoading} 
            onClick={(e) => {
              e.stopPropagation();
              isPanicActive ? handlePanicBuy() : handlePanicSell();
            }} 
            className={cn("px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", isPanicActive ? "text-emerald-500 hover:bg-emerald-500/10" : "text-rose-500 hover:bg-rose-500/10")} 
            title={isPanicActive ? "Piyasaya Dön" : "Panik Satış"}
          >
            {isPanicActive ? <RefreshCw className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            <span className="hidden xl:inline">{isPanicActive ? "GERİ AL" : "PANİK SAT"}</span>
          </button>

          <button 
            onClick={async (e) => {
              e.stopPropagation();
              console.log("[MatrixHorizon] Chef button clicked - Holistic Refresh");
              window.dispatchEvent(new CustomEvent("manual-refresh-triggered"));
              await Promise.all([
                 runAiAnalysis(),
                 (window as any)._mx_fetchSignal?.(true) || Promise.resolve()
              ]);
            }} 
            disabled={aiLoading || (authUser && !isAdmin && aiCooldown > 0)} 
            className={cn(
              "px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5", 
              aiLoading ? "bg-violet-500/50 animate-pulse text-white/50" : (aiResult ? "bg-violet-500 text-white" : "text-violet-400 hover:bg-violet-500/10 border border-violet-500/30")
            )} 
            title="Tam Sistem Analizi & AI Şef"
          >
            {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            <span className="hidden xl:inline">{aiLoading ? "HESAPLANIYOR" : "ŞEF"}</span>
          </button>

          <button 
            onClick={(e) => { 
              e.stopPropagation();
              const isActivating = !config.auto_trade;
              const mode = (typeof window !== "undefined" && localStorage.getItem("TRADING_MODE") === "production") ? "production" : "test"; 
              logger.success(
                isActivating ? "✈️ OTOMATİK PİLOT AKTİF" : "⏸ OTOMATİK PİLOT DEVRE DIŞI",
                `PİLOT durumu kullanıcı tarafından manuel olarak ${isActivating ? 'AÇILDI' : 'KAPATILDI'}.`
              );
              if (isActivating) { 
                saveConfig({ auto_trade: true }, () => { 
                  api.get(`/cron/strategies?immediate=true&tradingMode=${mode}`).catch(() => null); 
                }); 
              } else { 
                saveConfig({ auto_trade: false }); 
              } 
            }} 
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
              config.auto_trade ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400"
            )}
          >
            <Power className="w-3 h-3" />
            <span>PİLOT</span>
            <span className="opacity-70">{config.auto_trade ? "ON" : "OFF"}</span>
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }} 
            className={cn(
              "p-1.5 rounded-lg border transition-all", 
              showSettings ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" : "border-slate-800 text-slate-500 hover:text-white"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSectionExpanded(!isSectionExpanded);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
              isSectionExpanded ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
            )}
          >
            {isSectionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="hidden sm:inline">{isSectionExpanded ? "GİZLE" : "GÖSTER"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsPanelProps {
  config: BotConfig;
  saveConfig: (updates: Partial<BotConfig>, cb?: () => void) => void;
  isAdmin: boolean;
  lastSync?: Date | null;
  riskMode: string;
  setRiskMode: (m: any) => void;
}

const ADVANCED_PRESETS: Record<string, any> = {
  "1M": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 70, pilot_trailing_buy: false, pilot_only_holdings: true,
    allocation: 3, tp: 1.2, sl: 0.6, ttp: 0.15, tsl: 0.20, cover_tp: 1.1, cover_sl: 0.50, cover_ttp: 0.13, cover_tsl: 0.18,
    ai_threshold: 72, whale_multiplier: 1.0, fibo_length: 8, 
    f4_length: 5, f4_lookback_bars: 15, f4_squeeze_threshold: 10, f4_power_loss_threshold: 85, min_power_loss: 85,
    scalp_length: 5, scalp_volume_multiplier: 4.0, swing_length: 8, swing_volume_multiplier: 1.0, f4_active: true
  },
  "15M": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 65, pilot_trailing_buy: false, pilot_only_holdings: true,
    allocation: 5, tp: 1.0, sl: 0.55, ttp: 0.12, tsl: 0.18, cover_tp: 0.9, cover_sl: 0.40, cover_ttp: 0.10, cover_tsl: 0.15,
    ai_threshold: 65, whale_multiplier: 1.1, fibo_length: 13, 
    f4_length: 8, f4_lookback_bars: 20, f4_squeeze_threshold: 14, f4_power_loss_threshold: 87, min_power_loss: 87,
    scalp_length: 8, scalp_volume_multiplier: 3.5, swing_length: 9, swing_volume_multiplier: 1.1, f4_active: true
  },
  "1H": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 65, pilot_trailing_buy: true, pilot_only_holdings: true,
    allocation: 10, tp: 1.2, sl: 0.65, ttp: 0.12, tsl: 0.22, cover_tp: 1.1, cover_sl: 0.45, cover_ttp: 0.11, cover_tsl: 0.20,
    ai_threshold: 65, whale_multiplier: 1.2, fibo_length: 20, 
    f4_length: 11, f4_lookback_bars: 30, f4_squeeze_threshold: 20, f4_power_loss_threshold: 90, min_power_loss: 90,
    scalp_length: 11, scalp_volume_multiplier: 3.0, swing_length: 10, swing_volume_multiplier: 1.2, f4_active: true
  },
  "4H": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 68, pilot_trailing_buy: true, pilot_only_holdings: true,
    allocation: 12, tp: 2.0, sl: 1.0, ttp: 0.18, tsl: 0.28, cover_tp: 1.8, cover_sl: 0.65, cover_ttp: 0.16, cover_tsl: 0.25,
    ai_threshold: 68, whale_multiplier: 1.3, fibo_length: 26, 
    f4_length: 13, f4_lookback_bars: 40, f4_squeeze_threshold: 25, f4_power_loss_threshold: 88, min_power_loss: 88,
    scalp_length: 13, scalp_volume_multiplier: 2.5, swing_length: 12, swing_volume_multiplier: 1.3, f4_active: true
  },
  "1D": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 70, pilot_trailing_buy: true, pilot_only_holdings: true,
    allocation: 15, tp: 3.0, sl: 1.5, ttp: 0.28, tsl: 0.45, cover_tp: 2.7, cover_sl: 1.0, cover_ttp: 0.25, cover_tsl: 0.40,
    ai_threshold: 70, whale_multiplier: 1.4, fibo_length: 34, 
    f4_length: 16, f4_lookback_bars: 55, f4_squeeze_threshold: 30, f4_power_loss_threshold: 85, min_power_loss: 85,
    scalp_length: 16, scalp_volume_multiplier: 2.0, swing_length: 15, swing_volume_multiplier: 1.4, f4_active: true
  },
  "1W": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 75, pilot_trailing_buy: true, pilot_only_holdings: true,
    allocation: 20, tp: 6.0, sl: 3.0, ttp: 0.55, tsl: 0.90, cover_tp: 5.5, cover_sl: 2.0, cover_ttp: 0.50, cover_tsl: 0.80,
    ai_threshold: 75, whale_multiplier: 1.5, fibo_length: 50, 
    f4_length: 20, f4_lookback_bars: 80, f4_squeeze_threshold: 35, f4_power_loss_threshold: 80, min_power_loss: 80,
    scalp_length: 20, scalp_volume_multiplier: 1.8, swing_length: 18, swing_volume_multiplier: 1.5, f4_active: true
  },
  "1MO": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 80, pilot_trailing_buy: true, pilot_only_holdings: true,
    allocation: 25, tp: 12.0, sl: 6.0, ttp: 1.0, tsl: 1.6, cover_tp: 11.0, cover_sl: 4.0, cover_ttp: 0.9, cover_tsl: 1.4,
    ai_threshold: 80, whale_multiplier: 1.8, fibo_length: 89, 
    f4_length: 28, f4_lookback_bars: 120, f4_squeeze_threshold: 50, f4_power_loss_threshold: 75, min_power_loss: 75,
    scalp_length: 28, scalp_volume_multiplier: 1.5, swing_length: 25, swing_volume_multiplier: 1.6, f4_active: true
  },
};

const SettingsPanel = ({ config, saveConfig, isAdmin, lastSync, riskMode, setRiskMode }: SettingsPanelProps) => {
  const effectiveTradeMode = (riskMode === "scalp" || riskMode === "swing") 
    ? (riskMode === "scalp" ? "Scalp" : "Swing")
    : resolveTradeMode(config);

  const applyPreset = (tf: keyof typeof ADVANCED_PRESETS) => {
    const p = ADVANCED_PRESETS[tf];
    if (!p) return;
    
    saveConfig({
      pilot_timeframe: tf.toLowerCase(),
      pilot_mtf_veto: p.pilot_mtf_veto,
      pilot_mtf_threshold: p.pilot_mtf_threshold,
      pilot_trailing_buy: p.pilot_trailing_buy,
      pilot_only_holdings: p.pilot_only_holdings,
      ai_threshold: p.ai_threshold,
      whale_multiplier: p.whale_multiplier,
      fibo_length: p.fibo_length,
      f4_length: p.f4_length,
      f4_lookback_bars: p.f4_lookback_bars,
      f4_squeeze_threshold: p.f4_squeeze_threshold,
      f4_power_loss_threshold: p.f4_power_loss_threshold,
      min_power_loss: p.min_power_loss,
      scalp_length: p.scalp_length,
      scalp_volume_multiplier: p.scalp_volume_multiplier,
      swing_length: p.swing_length,
      swing_volume_multiplier: p.swing_volume_multiplier,
      pilot_tp_trailing: true,
      pilot_tp_deviation: p.ttp,
      pilot_sl_trailing: true,
      pilot_sl_deviation: p.tsl,
      pilot_trailing_buy_dev: p.ttp,
      timeframe_settings: {
        ...(config.timeframe_settings || {}),
        pilot_trade_allocation: p.allocation,
        pilot_tp_percent: p.tp,
        pilot_sl_percent: p.sl,
        pilot_sl_trailing: true,
        pilot_tp_trailing: true,
        pilot_tp_deviation: p.ttp,
        pilot_sl_deviation: p.tsl,
        cover_tp_percent: p.cover_tp,
        cover_sl_percent: p.cover_sl,
        cover_tp_trailing: true,
        cover_sl_trailing: true,
        cover_tp_deviation: p.cover_ttp,
        cover_sl_deviation: p.cover_tsl,
      },
    });
    logger.success(`🚀 ${tf} MASTER PRESET UYGULANDI`, `Gelişmiş AI, F4 ve Risk parametreleri başarıyla güncellendi.`);
  };

  return (
    <div className="relative z-30 bg-slate-950/90 backdrop-blur-xl border border-cyan-500/10 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-top-4 duration-300 mb-2">
      <div className="lg:col-span-3 space-y-4 flex flex-col">
        <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest mb-1 pb-2 border-b border-white/5"><Zap className="w-4 h-4 text-cyan-400" /> SİSTEM KONTROL</div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 text-[9px] text-slate-400 font-mono shadow-inner relative overflow-hidden group flex items-center justify-between">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-all" />
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-cyan-400 shrink-0" />
            <span className="text-cyan-400 font-bold uppercase tracking-widest shrink-0">ANGEL CONSOLE</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex bg-slate-950/80 rounded border border-white/5 p-0.5">
              <button 
                onClick={() => setRiskMode("scalp")} 
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-black transition-all border", 
                  effectiveTradeMode === "Scalp" 
                    ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                    : "text-slate-600 hover:text-slate-400 border-transparent",
                  effectiveTradeMode === "Scalp" && config.auto_trade && "animate-pulse"
                )}
              >SCALP</button>
              <button 
                onClick={() => setRiskMode("swing")} 
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-black transition-all border", 
                  effectiveTradeMode === "Swing" 
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                    : "text-slate-600 hover:text-slate-400 border-transparent",
                  effectiveTradeMode === "Swing" && config.auto_trade && "animate-pulse"
                )}
              >SWING</button>
            </div>


            <button 
              onClick={() => saveConfig({ defense_mode: !config.defense_mode })}
              className={cn("px-1.5 py-1 rounded border text-[8px] font-black transition-all shadow-sm", config.defense_mode ? "bg-rose-500/20 text-rose-400 border-rose-500/40" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}
            >
              {config.defense_mode ? "REINFORCED" : "STD"}
            </button>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-white/5">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-0">
              <Settings2 className="w-3.5 h-3.5 text-cyan-500" /> İŞLEM MODU
            </label>
            <div className="flex bg-slate-950/80 rounded border border-white/5 p-0.5">
              <button 
                onClick={() => saveConfig({ pilot_mode: 'matrix' })}
                className={cn("px-2 py-1 rounded text-[8px] font-black transition-all", (config.pilot_mode === 'matrix' || !config.pilot_mode) ? "bg-cyan-500/20 text-cyan-400" : "text-slate-600 hover:text-slate-400")}
              >MATRIX</button>
              <button 
                onClick={() => saveConfig({ pilot_mode: 'hedge' })}
                className={cn("px-2 py-1 rounded text-[8px] font-black transition-all", config.pilot_mode === 'hedge' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-600 hover:text-slate-400")}
              >HEDGE</button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-white/5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-cyan-500" /> USDT RE-ENTRY
            </span>
            <button 
              onClick={() => saveConfig({ pilot_use_usdt: !config.pilot_use_usdt })} 
              className={cn("px-2 py-1 rounded text-[8px] font-black uppercase transition-all border", config.pilot_use_usdt ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-slate-950 text-slate-600 border-slate-800")}
            >
              {config.pilot_use_usdt ? "AKTİF" : "PASİF"}
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-lg border border-white/5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-500" /> MTF VETO
            </span>
            <button 
              onClick={() => saveConfig({ pilot_mtf_veto: !(config.pilot_mtf_veto ?? true) })} 
              className={cn("px-2 py-1 rounded text-[8px] font-black uppercase transition-all border", (config.pilot_mtf_veto ?? true) ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : "bg-slate-950 text-slate-600 border-slate-800")}
            >
              {(config.pilot_mtf_veto ?? true) ? "AKTİF" : "PASİF"}
            </button>
          </div>

          <div className="bg-slate-900/50 p-2 rounded-lg border border-white/5 space-y-1.5">
            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <span>EŞİK (THRESHOLD)</span>
              <span className="text-amber-500">{config.pilot_mtf_threshold ?? 70}%</span>
            </div>
            <input 
              type="range" min="10" max="100" step="5" 
              value={config.pilot_mtf_threshold ?? 70} 
              onChange={(e) => saveConfig({ pilot_mtf_threshold: parseInt(e.target.value) })} 
              className="w-full h-1 accent-amber-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
            />
          </div>
        </div>
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
            {(Object.keys(ADVANCED_PRESETS) as Array<string>).map((tf) => (
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

      {/* YENİ BÖLÜM: AI & İNDİKATÖR (GELİŞMİŞ MOTOR) AYARLARI */}
      <div className="lg:col-span-12 mt-4 pt-4 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-black text-violet-400 uppercase tracking-widest pb-2 border-b border-white/10">
          <Brain className="w-4 h-4" /> AI & İNDİKATÖR (GELİŞMİŞ MOTOR)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* AI Güven Skoru (Threshold) */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-violet-500/20 shadow-inner shadow-violet-500/5">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>AI Güven Eşiği</span>
              <span className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{config.ai_threshold ?? DEFAULT_BOT_CONFIG.ai_threshold}%</span>
            </div>
            <input type="range" min="10" max="100" step="5" value={config.ai_threshold ?? DEFAULT_BOT_CONFIG.ai_threshold} onChange={(e) => saveConfig({ ai_threshold: parseInt(e.target.value) })} className="w-full h-1 accent-violet-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* Whale (Balina) Hacim Çarpanı */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-cyan-500/20 shadow-inner shadow-cyan-500/5">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>Balina Çarpanı (Vol)</span>
              <span className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{config.whale_multiplier ?? DEFAULT_BOT_CONFIG.whale_multiplier}x</span>
            </div>
            <input type="range" min="1.1" max="10.0" step="0.1" value={config.whale_multiplier ?? DEFAULT_BOT_CONFIG.whale_multiplier} onChange={(e) => saveConfig({ whale_multiplier: parseFloat(e.target.value) })} className="w-full h-1 accent-cyan-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* Fibo Length */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-emerald-500/20 shadow-inner shadow-emerald-500/5">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>Fibo Periyodu</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{config.fibo_length ?? DEFAULT_BOT_CONFIG.fibo_length} Bar</span>
            </div>
            <input type="range" min="5" max="100" step="1" value={config.fibo_length ?? DEFAULT_BOT_CONFIG.fibo_length} onChange={(e) => saveConfig({ fibo_length: parseInt(e.target.value) })} className="w-full h-1 accent-emerald-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* F4 Length */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-blue-500/20 shadow-inner shadow-blue-500/5">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>F4 Uzunluğu</span>
              <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{config.f4_length ?? DEFAULT_BOT_CONFIG.f4_length} Bar</span>
            </div>
            <input type="range" min="5" max="50" step="1" value={config.f4_length ?? DEFAULT_BOT_CONFIG.f4_length} onChange={(e) => saveConfig({ f4_length: parseInt(e.target.value) })} className="w-full h-1 accent-blue-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* F4 Lookback */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-blue-500/20">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>F4 Taraması (Lookback)</span>
              <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{config.f4_lookback_bars ?? DEFAULT_BOT_CONFIG.f4_lookback_bars ?? 30} Bar</span>
            </div>
            <input type="range" min="5" max="100" step="5" value={config.f4_lookback_bars ?? DEFAULT_BOT_CONFIG.f4_lookback_bars ?? 30} onChange={(e) => saveConfig({ f4_lookback_bars: parseInt(e.target.value) })} className="w-full h-1 accent-blue-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* F4 Squeeze */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-rose-500/20">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>F4 Sıkışma Limiti</span>
              <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{config.f4_squeeze_threshold ?? DEFAULT_BOT_CONFIG.f4_squeeze_threshold ?? 20}</span>
            </div>
            <input type="range" min="5" max="50" step="1" value={config.f4_squeeze_threshold ?? DEFAULT_BOT_CONFIG.f4_squeeze_threshold ?? 20} onChange={(e) => saveConfig({ f4_squeeze_threshold: parseInt(e.target.value) })} className="w-full h-1 accent-rose-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* F4 Power Loss Threshold */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-amber-500/20">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>F4 Güç Kaybı Eşiği</span>
              <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{config.f4_power_loss_threshold ?? DEFAULT_BOT_CONFIG.f4_power_loss_threshold}%</span>
            </div>
            <input type="range" min="50" max="100" step="1" value={config.f4_power_loss_threshold ?? DEFAULT_BOT_CONFIG.f4_power_loss_threshold} onChange={(e) => saveConfig({ f4_power_loss_threshold: parseInt(e.target.value) })} className="w-full h-1 accent-amber-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

          {/* Min Power Loss */}
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-amber-500/20">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <span>Güç Kaybı Alt Sınır</span>
              <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{config.min_power_loss ?? DEFAULT_BOT_CONFIG.min_power_loss}%</span>
            </div>
            <input type="range" min="10" max="100" step="5" value={config.min_power_loss ?? DEFAULT_BOT_CONFIG.min_power_loss} onChange={(e) => saveConfig({ min_power_loss: parseInt(e.target.value) })} className="w-full h-1 accent-amber-500 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" />
          </div>

        </div>
      </div>
    </div>
  );
};
