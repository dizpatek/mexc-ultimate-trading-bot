import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DecisionBar } from "./DecisionBar";
import { DataStream } from "./DataStream";
import { CentralCommand } from "./CentralCommand";
import { MatrixPortfolio } from "../MatrixPortfolio"; // Real Asset List Component
import { RefreshCw, LayoutTemplate } from "lucide-react"; 

// Types
type MarketRegime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";
type WhaleStatus = "RALLİ HAZIRLIĞI" | "DAĞITIM" | "TUZAK" | "NORMAL" | "BALİNA GİRİŞİ 🐳" | "NORMAL AKIŞ";
type MomentumState = "HIZLANIYOR 🚀" | "YAVAŞLIYOR ⚠️" | "ÇÖKÜŞ 💀" | "DİP ARAYIŞI 🔄" | "PATLAMA ÖNCESİ 💥" | "YATAY 🌫️" | "ANALİZ EDİLİYOR...";
type SystemDecision = "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";

const INITIAL_DATA = {
  technical: {
    mode: "ANALİZ EDİLİYOR..." as string,
    structure: "VERİ BEKLENİYOR...",
    f4Trend: "---",
    fiboTrend: "---",
    momentum: "---",
    divergence: "---"
  },
  market: {
    btcd: { value: 0, change: 0, trend: "---" },
    usdtd: { value: 0, change: 0, trend: "---" },
    othersd: { value: 0, change: 0, trend: "---" },
    flow: "ANALİZ EDİLİYOR..."
  },
  whale: {
    status: "NORMAL" as WhaleStatus,
    regime: "NEUTRAL" as MarketRegime,
    aiScore: 50,
    prediction: "DİP ARAYIŞI 🔄" as MomentumState,
    capital: "---",
    btcCheck: true,
    freshness: "EŞİTLENİYOR...",
    whaleType: "---",
    moduleHealth: "EŞİTLENİYOR",
    protection: "AKTİF"
  },
  engineering: {
    mtfConsensus: "---",
    momentumAccel: "---",
    volatility: "---",
    zScore: "---",
    winRate: 0
  },
  decision: {
    system: "BEKLE ❌" as SystemDecision,
    aiSuggestion: "VERİ BEKLENİYOR..."
  }
};


export const MatrixHorizon = () => {
    const [data, setData] = useState(INITIAL_DATA);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [interval, setIntervalState] = useState('4h');

    const intervals = [
        { id: '4h', label: '4S' },
        { id: '1d', label: 'GÜNLÜK' },
        { id: '1w', label: 'HAFTALIK' },
        { id: '1M', label: 'AYLIK' }
    ];

    useEffect(() => {
        const fetchGlobalState = async () => {
            try {
                // Fetch ETH Analyis (Proxy for Others/Alts)
                const res = await fetch(`/api/indicators/f4?symbol=ETHUSDT&interval=${interval}`);
                if (!res.ok) return;
                
                const btcData = await res.json();
                if (btcData.error) return;

                const getPredictionLabel = (pred: string): MomentumState => {
                    // Engine V3 Keys
                    if (pred === "ACCELERATING_TREND") return "HIZLANIYOR 🚀";
                    if (pred === "DECELERATING_TREND") return "YAVAŞLIYOR ⚠️";
                    if (pred === "ACCELERATING_DROP") return "ÇÖKÜŞ 💀";
                    if (pred === "BOTTOM_FINDING") return "DİP ARAYIŞI 🔄";
                    if (pred === "RANGE") return "YATAY 🌫️";
                    if (pred === "STOPPING_VOLUME") return "DİP ARAYIŞI 🔄";
                    if (pred === "PRE_EXPLOSION") return "PATLAMA ÖNCESİ 💥";
                    return "ANALİZ EDİLİYOR...";
                };

                // Transform API data to Dashboard Model
                setData({
                    technical: {
                        mode: btcData.trend === "BULLISH" ? "TREND TAKİBİ" : btcData.trend === "BEARISH" ? "TERS YÖN" : "NÖTR",
                        structure: btcData.marketRegime === "RISK_ON" ? "BOĞA YAPISI" : btcData.marketRegime === "RISK_OFF" ? "AYI YAPISI" : "AKÜMÜLASYON",
                        f4Trend: btcData.f4Slope > 0 ? "YÜKSELİYOR 🟢" : "DÜŞÜYOR 🔴",
                        fiboTrend: btcData.aiScore > 65 ? "GÜÇLÜ 🟢" : btcData.aiScore < 35 ? "ZAYIF 🔴" : "NÖTR ⚪",
                        momentum: btcData.f4Acceleration > 0 ? "ARTIYOR 🚀" : "AZALIYOR ⚠️",
                        divergence: btcData.aiComponents.volumePower > 0 ? "POZİTİF" : "NÖTR"
                    },
                    market: {
                        btcd: { value: 58.4, change: 0.1, trend: "UP" }, // Static for now
                        usdtd: { value: 4.2, change: -0.5, trend: "DOWN" },
                        othersd: { value: 12.1, change: 0.4, trend: "UP" },
                        flow: btcData.systemDecision === "GO_LONG" ? "RİSK İŞTAHI 🔥" : btcData.systemDecision === "GO_SHORT" ? "KORUMACI 🛡️" : "NÖTR ⚖️"
                    },
                    whale: {
                        status: btcData.whaleDetected ? "BALİNA GİRİŞİ 🐳" : "NORMAL AKIŞ",
                        regime: btcData.marketRegime as MarketRegime,
                        aiScore: btcData.aiScore,
                        prediction: getPredictionLabel(btcData.regimePrediction),
                        capital: btcData.aiComponents.whaleConfirmed > 0 ? "GÜÇLÜ GİRİŞ" : btcData.aiComponents.trapPenalty < 0 ? "TUZAK!" : "NORMAL",
                        btcCheck: true,
                        freshness: "CANLI 🟢",
                        whaleType: btcData.whaleDetected ? "ALGORİTMİK" : "---",
                        moduleHealth: "ÇALIŞIYOR",
                        protection: btcData.volatilityRegime === "EXPLOSION" ? "VOLATİLİTE!" : "AKTİF"
                    },
                    engineering: {
                        mtfConsensus: btcData.mtfConsensus === "STRONG_BULL" ? "BOĞA KONSENSÜS" : btcData.mtfConsensus === "STRONG_BEAR" ? "AYI KONSENSÜS" : "KARIŞIK",
                        momentumAccel: btcData.f4Acceleration > 0.5 ? "YÜKSEK HIZ" : btcData.f4Acceleration > 0 ? "GÜÇLENİYOR" : "YAVAŞLIYOR",
                        volatility: btcData.volatilityRegime === "HIGH_VOL" ? "YÜKSEK" : btcData.volatilityRegime === "SQUEEZE" ? "SIKIŞMA" : "NORMAL",
                        zScore: btcData.zScoreValue ? btcData.zScoreValue.toFixed(2) : "0.00",
                        winRate: btcData.aiComponents.bayesianWinRate ? (btcData.aiComponents.bayesianWinRate * 10) : 50
                    },
                    decision: {
                        system: btcData.systemDecision === "GO_LONG" ? "İŞLEM AÇ ✅" : btcData.systemDecision === "GO_SHORT" ? "SATIŞ YAP 📉" : "BEKLE ❌" as SystemDecision,
                        aiSuggestion: btcData.systemDecision === "GO_LONG" ? "MOMENTUM LONG" : btcData.systemDecision === "GO_SHORT" ? "DÜŞÜŞ TRENDİ" : "NÖTR/BEKLE"
                    }
                });
                setLastSync(new Date());

            } catch (error) {
                console.error("Failed to sync Mission Control", error);
            }
        };

        fetchGlobalState();
        const loop = setInterval(fetchGlobalState, 10000);
        return () => clearInterval(loop);
    }, [interval]);

    return (
        <div className="w-full h-full min-h-[500px] bg-[#020617] relative p-4 flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-800">
            
            {/* GRID BACKGROUND */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                 style={{ 
                     backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                     backgroundSize: '40px 40px'
                 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent pointer-events-none" />

            {/* HEADER BAR: TITLE, INTERVALS & SYNC */}
            <div className="relative z-20 flex items-center justify-between pb-4 border-b border-slate-800/50 mb-2">
                
                {/* LEFT: TITLE & CONTROLS */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-100 uppercase font-mono shadow-cyan-500/50 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                            KOMUTA MERKEZİ
                        </h2>
                    </div>
                    
                    {/* INTERVAL SELECTOR */}
                    <div className="hidden md:flex bg-slate-900/50 backdrop-blur rounded-lg border border-slate-700/50 p-0.5">
                        {intervals.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setIntervalState(item.id)}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-300",
                                    interval === item.id 
                                        ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 scale-105" 
                                        : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: SYNC STATUS */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        {lastSync ? (
                            <>
                                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_cyan]"/>
                                EŞİTLENDİ: {lastSync.toLocaleTimeString()}
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-3 h-3 animate-spin text-cyan-500"/>
                                <span className="animate-pulse">BAŞLATILIYOR...</span>
                            </>
                        )}
                    </div>
                    <div className="text-[9px] font-bold text-slate-600 tracking-wider bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                        KAYNAK: ETH/ALT (VEKİL) [{interval.toUpperCase()}]
                    </div>
                </div>
            </div>

            {/* MAIN LAYOUT: Responsive Grid (Stack on mobile, 3-col on desktop) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10 overflow-y-auto lg:overflow-visible">
                
                {/* LEFT WING: TECHNICAL & ENGINEERING */}
                <div className="order-2 lg:order-1 col-span-1 lg:col-span-3 flex flex-col gap-4 min-h-[300px] lg:min-h-auto">
                    <DataStream 
                        title="TEKNİK GÖSTERGELER" 
                        side="left"
                        data={[
                            { label: "MOD", value: data.technical.mode, color: "text-cyan-400" },
                            { 
                                label: "YAPI", 
                                value: data.technical.structure, 
                                color: data.technical.structure.includes("BOĞA") ? "text-emerald-400" : data.technical.structure.includes("AYI") ? "text-rose-400" : "text-amber-400" 
                            },
                            { 
                                label: "F4 TREND", 
                                value: data.technical.f4Trend, 
                                trend: data.technical.f4Trend.includes("YÜKSELİYOR") ? "UP" : "DOWN", 
                                color: data.technical.f4Trend.includes("YÜKSELİYOR") ? "text-emerald-400" : "text-rose-400" 
                            },
                            { 
                                label: "MOMENTUM", 
                                value: data.technical.momentum, 
                                color: data.technical.momentum.includes("ARTIYOR") ? "text-emerald-400" : data.technical.momentum.includes("AZALIYOR") ? "text-rose-400" : "text-amber-400" 
                            },
                        ]} 
                    />
                    <DataStream 
                        title="MÜHENDİSLİK VERİLERİ" 
                        side="left"
                        data={[
                            { label: "ÇOKLU ZAMAN ONAYI", value: data.engineering.mtfConsensus, trend: data.engineering.mtfConsensus.includes("BOĞA") ? "UP" : "DOWN", color: data.engineering.mtfConsensus.includes("BOĞA") ? "text-emerald-400" : "text-rose-400" },
                            { label: "İVME", value: data.engineering.momentumAccel, trend: data.engineering.momentumAccel.includes("YAVAŞLIYOR") ? "DOWN" : "UP", color: data.engineering.momentumAccel === "YÜKSEK HIZ" ? "text-emerald-400" : data.engineering.momentumAccel === "YAVAŞLIYOR" ? "text-rose-400" : "text-amber-400" },
                            { label: "VOLATİLİTE", value: data.engineering.volatility, color: data.engineering.volatility === "YÜKSEK" ? "text-rose-400" : "text-cyan-400" },
                            { label: "KAZANMA ORANI", value: `${data.engineering.winRate}/10`, color: data.engineering.winRate > 6 ? "text-emerald-400" : "text-amber-400" },
                        ]} 
                    />
                </div>

                {/* CENTER COMMAND: THE EYE */}
                <div className="order-1 lg:order-2 col-span-1 lg:col-span-6 flex items-center justify-center relative min-h-[300px] lg:min-h-auto py-8 lg:py-0">
                    <CentralCommand 
                        score={data.whale.aiScore} 
                        status={data.whale.status} 
                        prediction={data.whale.prediction}
                    />
                    
                    {/* Floating Capital Tracker */}
                    <div className="absolute top-0 lg:top-4 left-1/2 -translate-x-1/2 bg-slate-900/50 backdrop-blur px-4 py-1 rounded-full border border-slate-700/50 text-[10px] text-slate-400 font-mono w-max">
                        SERMAYE AKIŞI: <span className={data.whale.capital.includes("GÜÇLÜ") ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{data.whale.capital}</span>
                    </div>

                    {/* Left/Right Connectors (Hidden on Mobile) */}
                    <div className="hidden lg:block absolute left-0 top-1/2 w-8 h-[1px] bg-cyan-500/30" />
                    <div className="hidden lg:block absolute right-0 top-1/2 w-8 h-[1px] bg-cyan-500/30" />
                </div>

                {/* RIGHT WING: MARKET DATA */}
                <div className="order-3 col-span-1 lg:col-span-3 flex flex-col gap-4 min-h-[300px] lg:min-h-auto">
                     <DataStream 
                        title="PİYASA HAKİMİYETİ" 
                        side="right"
                        data={[
                            { label: "BTC.D", value: `${data.market.btcd.value}%`, trend: "UP", color: "text-amber-400" },
                            { label: "USDT.D", value: `${data.market.usdtd.value}%`, trend: "DOWN", color: "text-cyan-400" },
                            { label: "OTHERS.D", value: `${data.market.othersd.value}%`, trend: "UP", color: "text-rose-400" },
                        ]} 
                    />
                     <DataStream 
                        title="VARLIK KORUMASI" 
                        side="right"
                        data={[
                            { label: "KORUMA KALKANI", value: data.whale.protection, color: "text-emerald-400" },
                            { label: "MODÜL", value: data.whale.moduleHealth, color: data.whale.moduleHealth === "ÇALIŞIYOR" ? "text-emerald-400" : "text-amber-400" },
                            { label: "GÜNCELLİK", value: data.whale.freshness, color: data.whale.freshness.includes("CANLI") ? "text-emerald-400" : "text-amber-400" },
                        ]} 
                    />
                </div>

            </div>

            {/* BOTTOM DECK: EXECUTION */}
            <div className="relative z-20 mb-4">
                <DecisionBar 
                    decision={data.decision.system} 
                    aiSuggestion={data.decision.aiSuggestion} 
                    mode={data.technical.mode}
                />
            </div>

            {/* ASSET LIST (MATRIX DASHBOARD) */}
            <div className="relative z-10 flex-1 overflow-visible">
                 <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="w-1 h-4 bg-cyan-500 rounded-sm" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">VARLIK GÖZETİMİ</h3>
                    <div className="h-[1px] flex-1 bg-slate-800" />
                 </div>
                 <MatrixPortfolio />
            </div>

        </div>
    );
};
