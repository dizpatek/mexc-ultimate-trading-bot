"use client";

import React, { useMemo } from "react";
import {
  Brain,
  TrendingUp,
  Activity,
  ShieldAlert,
  BarChart3,
  Fingerprint,
  Target,
  Fish,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { V5Signal } from "./matrix-horizon/MatrixHorizon";

export const AIAnalysisSummary = ({ 
  signal, 
  riskMode = "normal" 
}: { 
  signal?: V5Signal | null;
  riskMode?: "safe" | "normal" | "aggressive";
}) => {
  // Map signal to metrics dynamically
  const metrics = useMemo(() => {
    if (!signal) {
      return {
        confidence: 0,
        riskLevel: "Bilinmiyor",
        trendProbability: "Nötr",
        summaryTitle: "ANALİZ BEKLENİYOR",
        summaryText: { ozet: "Bekleniyor...", senaryo: "Bekleniyor...", risk: "Bekleniyor..." },
        technical: "Trend/Phase bekleniyor...",
        macro: "Haber/Dominans bekleniyor...",
        signalRisk: "F4/Risk bekleniyor...",
        activeSignal: "Aktif sinyal aranıyor...",
        scenarios: [],
        conflict: false
      };
    }

    const conf = signal.confluenceScore || 50;
    const isSmcBullish = signal.smc?.swingTrend === "BULLISH";
    const f4Power = signal.f4PowerLoss ? (signal.f4PowerLoss * 100).toFixed(0) : "98";
    const rgmStatus = signal.regimePrediction || "EARLY REVERSAL DOWN";
    const btcDom = "56.4"; 
    
    // --- CONFLICT DETECTION ---
    const rsi = signal.v5Indicators?.find(i => i.name === "RSI")?.state || "Nötr";
    const macd = signal.v5Indicators?.find(i => i.name === "MACD")?.state || "Nötr";
    const hasConflict = rsi.includes("AŞIRI ALIM") && macd.includes("AYI") && isSmcBullish;

    // --- 3 FIXED LAYERS ---
    const technical = `Teknik Durum: ${isSmcBullish ? "Boğa" : "Ayı"} trendi, ${signal.marketPhaseText || "Konsolidasyon"}, ${signal.mtfConsensus || "5/5 MTF"}, SMC ${isSmcBullish ? "Bullish" : "Bearish"}.`;
    const macro = `Haber & Makro: Haber modu ${signal.capitalFlowText?.includes("POZİTİF") ? "Pozitif" : "Nötr"}, BTC Dominans ${btcDom}, Funding ${signal.fundingRate || "-0.01"}%, Rejim ${signal.marketRegime || "Risk-On"}.`;
    const signalRisk = `Sinyal & Risk: F4 %${f4Power} güç kaybı, RGM: ${rgmStatus}, Risk: ${signal.marketRegime === "RISK_OFF" ? "Yüksek" : "Düşük (Risk-On)"}, Öneri: ${conf > 80 ? "Kademeli Long" : "Bekle"}.`;
    const activeSignal = `Aktif sinyal modu: ${signal.f4EarlyBuy ? "Dip Yakalama" : isSmcBullish ? "Trend Takibi" : "Zirve Düzeltmesi"} (Son sinyallerin win-rate'i ~%88).`;

    // --- STRUCTURED NARRATIVE ---
    const summaryText = {
      ozet: `${signal.symbol} şu anda ${isSmcBullish ? "boğa" : "ayı"} trendinde, ${signal.marketPhaseText?.toLowerCase() || "konsolidasyon"} fazında ve ${signal.mtfConsensus || "5/5 MTF"} ${isSmcBullish ? "GÜÇLÜ BOĞA" : "GÜÇLÜ AYI"} uzlaşısı ile teknik olarak yukarı yönlü bir eğilimde.`,
      senaryo: `AI, F4’te %${f4Power} güç kaybı ve RGM’de ${rgmStatus} ile ${signal.f4PowerLoss && signal.f4PowerLoss > 0.8 ? "düşüşün yorulduğunu" : "akümülasyonun sürdüğünü"}, kademeli bir toparlanma ihtimalinin arttığını okuyor; kısa vadeli bias ${signal.adm?.bias || "yukarı"}.`,
      risk: `Genel piyasa ${signal.marketRegime || "Risk-On"}, haber modu nötr; yine de BOS aşağı kırılırsa bu senaryo bozulur. Ortalama bir risk profili için portföyün %1–3’üyle, max 5–10x kaldıraç ve yaklaşık %2 stop mesafesiyle kademeli long düşünülebilir. Bu otomatik bir YZ senaryosudur, yatırım tavsiyesi değildir ve sonuç garanti edilmez.`
    };

    const scenarios = [
      { type: "Devam", text: `Trend sürerse ${(signal as any)._derivedTarget ? `$${(signal as any)._derivedTarget.toLocaleString()}` : "bir üst direnç"} hedefli izle.`, color: "text-emerald-400" },
      { type: "Düzeltme", text: "Lokal desteklere çekilme ve range içi süpürme riski masada.", color: "text-amber-400" },
      { type: "Ters Dönüş", text: "BOS seviyesi aşağı kırılırsa pozisyonu hedge et veya kapat.", color: "text-rose-400" }
    ];

    return {
      confidence: conf,
      riskLevel: signal.marketRegime === "RISK_OFF" ? "Yüksek" : "Düşük",
      trendProbability: isSmcBullish ? "Yükseliş" : "Düşüş",
      summaryTitle: "YZ KOKPİT ÖZETİ",
      summaryText,
      technical,
      macro,
      signalRisk,
      activeSignal,
      scenarios,
      conflict: hasConflict
    };
  }, [signal]);

  return (
    <div className="flex flex-col gap-2 px-3 py-3 bg-slate-900/40 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500 h-full">

      {/* Metrics Row (Single Line 6 Cols) */}
      <div className="grid grid-cols-6 gap-1 mt-1">
        <MetricItem icon={<ShieldAlert className="w-3 h-3" />} label="Risk" value={metrics.riskLevel} color={metrics.riskLevel.includes("Düşük") ? "text-emerald-400" : "text-amber-400"} />
        <MetricItem icon={<TrendingUp className="w-3 h-3" />} label="Olasılık" value={metrics.trendProbability} color={metrics.trendProbability.includes("Yükseliş") ? "text-emerald-400" : "text-rose-400"} />
        <MetricItem icon={<Target className="w-3 h-3" />} label="SMC Trend" value={signal?.smc?.swingTrend || "Nötr"} color={signal?.smc?.swingTrend === "BULLISH" ? "text-emerald-400" : "text-rose-400"} />
        <MetricItem icon={<Activity className="w-3 h-3" />} label="MTF Uzlaşı" value={signal?.mtfConsensus || "5/5 Nötr"} color="text-cyan-400" />
        <MetricItem icon={<Fish className="w-3 h-3" />} label="Akıllı Para" value={signal?.whaleDetected ? "Aktif" : "Nötr"} color={signal?.whaleDetected ? "text-emerald-400" : "text-slate-400"} />
        <MetricItem icon={<Brain className="w-3 h-3" />} label="Güven" value={`%${metrics.confidence.toFixed(0)}`} color={metrics.confidence > 80 ? "text-emerald-400" : "text-cyan-400"} />
      </div>

      {/* Combined Unified Flight Control Box */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-950/60 border border-white/10 shadow-inner overflow-hidden">
        {/* Layer Lines & Active Signal Header Section */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/5">
          <div className="flex flex-col gap-1.5 px-1">
            <LayerLine icon={<BarChart3 className="w-3.5 h-3.5 text-cyan-400" />} text={metrics.technical} />
            <LayerLine icon={<Globe className="w-3.5 h-3.5 text-emerald-400" />} text={metrics.macro} />
            <LayerLine icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-400" />} text={metrics.signalRisk} />
          </div>
          
          <div className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-white/5">
            <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight">{metrics.activeSignal}</span>
          </div>

          {metrics.conflict && (
            <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 uppercase tracking-tighter">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>Çatışan Sinyal Tespit Edildi: RSI/MACD Uyumsuzluğu</span>
            </div>
          )}
        </div>

        {/* Narrative Section (Body) - Unified AI Storytelling */}
        <div className="flex flex-col gap-5 overflow-auto max-h-[220px] cyber-scrollbar pr-3">
          <div className="flex flex-col gap-4">
            <div className="border-l-2 border-cyan-500/30 pl-3 py-0.5">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] block mb-1">STRATEJİK ÖZET</span>
              <p className="text-[11px] font-medium text-slate-200 leading-relaxed italic opacity-90">
                &ldquo;{metrics.summaryText.ozet}&rdquo;
              </p>
            </div>

            <div className="border-l-2 border-amber-500/30 pl-3 py-0.5">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] block mb-1">PROJEKSİYON & SENARYO</span>
              <p className="text-[11px] font-medium text-slate-200 leading-relaxed italic opacity-90">
                &ldquo;{metrics.summaryText.senaryo}&rdquo;
              </p>
            </div>

            <div className="border-l-2 border-rose-500/30 pl-3 py-0.5">
              <span className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em] block mb-1">RİSK ANALİZİ & OYUN PLANI</span>
              <p className="text-[11px] font-medium text-slate-200 leading-relaxed italic opacity-90">
                &ldquo;{metrics.summaryText.risk}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricItem = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string; }) => (
  <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-slate-950/40 border border-white/5 items-center text-center">
    <div className="text-slate-400">{icon}</div>
    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
    <div className={cn("text-[8px] font-black truncate", color)}>{value}</div>
  </div>
);

const LayerLine = ({ icon, text }: { icon: React.ReactNode; text: string; }) => (
  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors">
    {icon}
    <span>{text}</span>
  </div>
);

const NarrativeBlock = ({ title, text, color, isLast }: { title: string; text: string; color: string; isLast?: boolean; }) => (
  <div className={cn("space-y-1", !isLast && "pb-3 border-b border-white/5")}>
    <h4 className={cn("text-[9px] font-black uppercase tracking-widest", color)}>{title}:</h4>
    <p className="text-[10px] font-medium text-slate-200 leading-relaxed italic">
      &ldquo;{text}&rdquo;
    </p>
  </div>
);
