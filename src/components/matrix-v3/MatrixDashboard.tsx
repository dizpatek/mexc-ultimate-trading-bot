import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { 
  Activity, 
  BarChart, 
  Globe, 
  Layers, 
  Zap, 
  Shield, 
  Cpu, 
  Scale, 
  Target,
  Rocket
} from "lucide-react";

// Types derived from Pine Script
type TradeMode = "SCALP" | "SWING";
type MarketRegime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";
type WhaleStatus = "RALLİ HAZIRLIĞI" | "DAĞITIM" | "TUZAK" | "NORMAL";
type MomentumState = "HIZLANIYOR 🚀" | "YAVAŞLIYOR ⚠️" | "ÇÖKÜŞ 💀" | "DİP ARAYIŞI 🔄" | "PRE_EXPLOSION";
type SystemDecision = "İŞLEM AÇ ✅" | "BEKLE ❌";

// Mock Data Structure
const MOCK_DATA = {
  technical: {
    mode: "SCALP" as TradeMode,
    structure: "BOĞA TRENDİ",
    f4Trend: "YÜKSELİYOR 🟢",
    fiboTrend: "YÜKSELİYOR 🟢",
    momentum: "MOMENTUM ARTİYOR",
    divergence: "YOK"
  },
  market: {
    btcd: { value: 54.2, change: 0.5, trend: "UP" },
    usdtd: { value: 4.8, change: -1.2, trend: "DOWN" },
    othersd: { value: 12.5, change: 2.1, trend: "UP" },
    flow: "ALTCOIN SEZONU 🔥"
  },
  whale: {
    status: "RALLİ HAZIRLIĞI" as WhaleStatus,
    regime: "RISK_ON" as MarketRegime,
    aiScore: 85,
    prediction: "HIZLANAN TREND 🚀" as MomentumState,
    capital: "ANA AKIŞ (GÜÇLÜ)",
    btcCheck: true,
    freshness: "TAZE ⏱",
    whaleType: "GERÇEK BALİNA 🐳",
    moduleHealth: "AKTİF",
    protection: "AÇIK ✅"
  },
  engineering: {
    mtfConsensus: "GÜÇLÜ YÜKSELİŞ (5/5)",
    momentumAccel: "HIZLANIYOR 🚀",
    volatility: "NORMAL",
    zScore: "NORMAL",
    winRate: 72
  },
  decision: {
    system: "İŞLEM AÇ ✅" as SystemDecision,
    aiSuggestion: "RALLİ MODU 🔥"
  }
};

const MetricRow = ({ label, value, colorClass = "text-slate-300", icon }: { label: string, value: string | React.ReactNode, colorClass?: string, icon?: React.ReactNode }) => (
  <div className="flex items-center justify-between text-xs py-1.5 border-b border-cyan-900/10 last:border-0 hover:bg-white/5 px-1 rounded transition-colors">
    <div className="flex items-center gap-2 text-slate-500 font-medium tracking-tight">
      {icon && <span className="opacity-70 w-3.5 h-3.5 text-cyan-500/70">{icon}</span>}
      <span>{label}</span>
    </div>
    <span className={cn("font-mono font-semibold tracking-wide drop-shadow-sm", colorClass)}>
      {value}
    </span>
  </div>
);

const ProgressBar = ({ value, color = "bg-cyan-500" }: { value: number, color?: string }) => (
  <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden mt-1 shadow-inner shadow-black/20">
    <div 
      className={cn("h-full transition-all duration-700 ease-out shadow-[0_0_10px_currentColor]", color)} 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }} 
    />
  </div>
);

export const MatrixDashboard = () => {
    const [data, setData] = useState(MOCK_DATA);

    useEffect(() => {
        const interval = setInterval(() => {
            setData(prev => ({
                ...prev,
                whale: {
                    ...prev.whale,
                    aiScore: Math.min(100, Math.max(0, prev.whale.aiScore + (Math.random() > 0.5 ? 1 : -1)))
                }
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const getScoreColor = (score: number) => {
        if (score >= 75) return "text-emerald-400"; 
        if (score >= 50) return "text-amber-400"; 
        return "text-rose-500"; 
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 h-full w-full p-3 bg-slate-950 font-sans">
            
            {/* 1. TECHNICAL ANALYSIS */}
            <SectionCard title="TEKNİK ANALİZ" icon={<Activity />}>
                <MetricRow label="MOD" value={data.technical.mode} icon={<Zap size={12} />} colorClass="text-cyan-400" />
                <MetricRow label="YAPI (SMC)" value={data.technical.structure} icon={<Layers size={12} />} colorClass="text-emerald-400" />
                <MetricRow label="F4 EĞİLİMİ" value={data.technical.f4Trend} icon={<BarChart size={12} />} colorClass="text-emerald-400" />
                <MetricRow label="FIBO TREND" value={data.technical.fiboTrend} icon={<Activity size={12} />} colorClass="text-emerald-400" />
                <MetricRow label="MOMENTUM" value={data.technical.momentum} icon={<Cpu size={12} />} colorClass="text-cyan-400" />
                <MetricRow label="UYUMSUZLUK" value={data.technical.divergence} icon={<Scale size={12} />} colorClass="text-slate-400" />
            </SectionCard>

            {/* 2. MARKET DATA */}
            <SectionCard title="PİYASA VERİLERİ" icon={<Globe />}>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-[11px] font-medium items-center mb-1.5">
                            <span className="text-slate-400 flex items-center gap-1">BTC.DOM {data.market.btcd.trend === "UP" ? <span className="text-emerald-500">▲</span> : <span className="text-rose-500">▼</span>}</span>
                            <span className={data.market.btcd.change >= 0 ? "text-emerald-400" : "text-rose-500"}>{data.market.btcd.value}%</span>
                        </div>
                        <ProgressBar value={data.market.btcd.value} color="bg-amber-500" />
                    </div>
                    <div>
                        <div className="flex justify-between text-[11px] font-medium items-center mb-1.5">
                            <span className="text-slate-400 flex items-center gap-1">USDT.DOM {data.market.usdtd.trend === "UP" ? <span className="text-emerald-500">▲</span> : <span className="text-rose-500">▼</span>}</span>
                            <span className={data.market.usdtd.change >= 0 ? "text-emerald-400" : "text-rose-500"}>{data.market.usdtd.value}%</span>
                        </div>
                        <ProgressBar value={data.market.usdtd.value} color="bg-cyan-500" />
                    </div>
                     <div>
                        <div className="flex justify-between text-[11px] font-medium items-center mb-1.5">
                            <span className="text-slate-400 flex items-center gap-1">OTHERS.D {data.market.othersd.trend === "UP" ? <span className="text-emerald-500">▲</span> : <span className="text-rose-500">▼</span>}</span>
                            <span className={data.market.othersd.change >= 0 ? "text-emerald-400" : "text-rose-500"}>{data.market.othersd.value}%</span>
                        </div>
                         <ProgressBar value={data.market.othersd.value} color="bg-rose-500" />
                    </div>
                </div>
                <div className="mt-auto py-2.5 px-3 bg-slate-800/30 border border-slate-700/30 rounded text-center">
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider block mb-1">PİYASA AKIŞI</span>
                    <span className="text-xs font-bold text-emerald-400 animate-pulse drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">{data.market.flow}</span>
                </div>
            </SectionCard>

            {/* 3. WHALE & DECISION ENGINE */}
            <SectionCard title="WHALE MASTER ENGINE" icon={<Target />}>
                <MetricRow label="BALİNA DURUMU" value={data.whale.status} colorClass="text-cyan-400" />
                <MetricRow label="PİYASA REJİMİ" value={data.whale.regime} colorClass={data.whale.regime === "RISK_ON" ? "text-emerald-400" : "text-rose-400"} />
                
                <div className="py-3 border-y border-cyan-900/10 my-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-500 tracking-wider">AI GÜVEN SKORU</span>
                        <span className={cn("text-lg font-bold font-mono", getScoreColor(data.whale.aiScore))}>{data.whale.aiScore}/100</span>
                    </div>
                    <ProgressBar value={data.whale.aiScore} color={data.whale.aiScore > 65 ? "bg-emerald-500" : "bg-rose-500"} />
                </div>

                <MetricRow label="GELECEK TAHMİN" value={data.whale.prediction} icon={<Rocket size={12} />} colorClass="text-amber-400" />
                <MetricRow label="SERMAYE YÖNÜ" value={data.whale.capital} colorClass="text-slate-300" />
            </SectionCard>

            {/* 4. ENGINEERING ANALYSIS */}
            <SectionCard title="MÜHENDİSLİK ANALİZİ" icon={<Cpu />}>
                 <MetricRow label="MTF UZLAŞI (X/5)" value={data.engineering.mtfConsensus} colorClass="text-emerald-400" />
                 <MetricRow label="MOMENTUM İVME" value={data.engineering.momentumAccel} colorClass="text-cyan-400" />
                 <MetricRow label="VOLATİLİTE" value={data.engineering.volatility} colorClass="text-slate-300" />
                 <MetricRow label="Z-SKOR" value={data.engineering.zScore} colorClass="text-slate-300" />
                 
                 <div className="mt-2 p-3 bg-slate-900/40 rounded border border-cyan-900/20 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">KAZANMA ORANI (BAYESIAN)</span>
                    <span className="text-2xl font-bold text-emerald-400 drop-shadow-md">%{data.engineering.winRate}</span>
                 </div>
            </SectionCard>

            {/* 5. FINAL DECISION */}
            <SectionCard title="SİSTEM KARARI & AI" icon={<Shield />} className="border-l-4 border-l-emerald-500" borderColor="border-emerald-500/20">
                <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
                    
                    {/* SYSTEM DECISION */}
                    <div className="w-full">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-3 block">NİHAİ KARAR</span>
                        <div className={cn(
                            "text-xl font-black font-mono px-4 py-3 rounded-lg border w-full animate-pulse transition-all shadow-lg",
                            data.decision.system.includes("İŞLEM AÇ") 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/20" 
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/20"
                        )}>
                            {data.decision.system}
                        </div>
                    </div>

                    {/* AI SUGGESTION */}
                    <div className="w-full">
                         <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-2 block">YAPAY ZEKA ÖNERİSİ</span>
                         <div className="text-xs font-mono font-medium text-cyan-300 bg-cyan-950/30 px-3 py-2.5 rounded border border-cyan-500/20 shadow-inner shadow-cyan-500/5">
                            {data.decision.aiSuggestion}
                         </div>
                    </div>
                    
                    {/* Footer Status */}
                    <div className="flex gap-2 w-full mt-auto">
                         <div className="flex-1 text-[9px] font-bold bg-rose-500/5 text-rose-400 py-1.5 rounded text-center border border-rose-500/10">
                            KILL SWITCH: KAPALI
                         </div>
                         <div className="flex-1 text-[9px] font-bold bg-emerald-500/5 text-emerald-400 py-1.5 rounded text-center border border-emerald-500/10">
                            AĞ DURUMU: NORMAL
                         </div>
                    </div>

                </div>
            </SectionCard>

        </div>
    );
};
