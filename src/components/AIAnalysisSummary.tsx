"use client";

import React, { useMemo } from "react";
import {
  Brain,
  TrendingUp,
  Activity,
  ShieldAlert,
  BarChart3,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { V5Signal } from "./matrix-horizon/MatrixHorizon";

export const AIAnalysisSummary = ({ signal }: { signal?: V5Signal | null }) => {
  // Map signal to metrics dynamically
  const metrics = useMemo(() => {
    if (!signal) {
      return {
        confidence: 0,
        prediction: "YATAY",
        capitalFlow: "Bekleniyor...",
        marketCondition: "Veri Yok",
        riskLevel: "Bilinmiyor",
        trendProbability: "Nötr",
        smartMoneyScore: 0,
        bullishBias: "Bekleniyor",
        summaryTitle: "ANALİZ BEKLENİYOR",
        summaryText: "Piyasa verileri için canlı analiz bekleniyor...",
      };
    }

    const conf = signal.confluenceScore || 50;
    const isUp = signal.prediction?.direction === "UP";
    const isDown = signal.prediction?.direction === "DOWN";
    const pdTrend = isUp
      ? "Yükseliş Eğilimli"
      : isDown
        ? "Düşüş Eğilimli"
        : "Kararsız";

    return {
      confidence: conf,
      prediction: signal.prediction?.text || "ANALİZ GEREKLİ",
      capitalFlow: signal.capitalFlowText || "Para Yok ❌",
      marketCondition: signal.marketPhaseText || "Kontrollü Toplama",
      riskLevel:
        signal.marketRegime === "RISK_ON"
          ? "Düşük (Risk-On)"
          : signal.marketRegime === "RISK_OFF"
            ? "Yüksek (Risk-Off)"
            : "Orta",
      trendProbability: pdTrend,
      smartMoneyScore: ((signal.whaleTrust || 0.5) * 10).toFixed(1),
      bullishBias: signal.adm?.bias || "Nötr Piyasa Çıktısı",
      summaryTitle: "Aİ Özet & Tavsiye",
      summaryText: `Şu an piyasa ${signal.marketPhaseText?.toLowerCase() || "kararsız"} bir bölgede, güven oranımız %${conf.toFixed(1)} seviyesinde. Sermaye akışı '${signal.capitalFlowText || "henüz zayıf"}' konumunda olduğu için ${signal.prediction?.direction === "FLAT" ? "yatay" : signal.prediction?.direction === "UP" ? "yükseliş" : "düşüş"} bir seyir bekliyoruz. Ancak akıllı para tarafında ${signal.whaleDetected ? "aktif bir balina izi" : "sessiz bir toplama emaresi"} var, bu da sistemin ${signal.volatilityRegime === "SQUEEZE" ? "sıkışmakta olduğunu" : "sakin kaldığını"} gösteriyor. Kısacası; sistem '${signal.systemDecision === "GO_LONG" ? "uygun noktadan alım yap" : signal.systemDecision === "GO_SHORT" ? "satış yönlü düşün" : "fırsat kolla ama riskini koru"}' diyor.`,
    };
  }, [signal]);

  return (
    <div className="flex flex-col gap-3 px-3 py-4 bg-slate-900/40 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Brain className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            AI KOKPİT ÖZETİ
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              signal ? "bg-emerald-500 animate-pulse" : "bg-slate-500",
            )}
          />
          <span
            className={cn(
              "text-[8px] font-bold uppercase",
              signal ? "text-emerald-500/80" : "text-slate-500/80",
            )}
          >
            {signal ? "Canlı" : "Bekliyor"}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <MetricItem
          icon={<Activity className="w-3 h-3" />}
          label="SERMAYE AKIŞI"
          value={metrics.capitalFlow}
          color={
            metrics.capitalFlow?.includes("POZİTİF")
              ? "text-emerald-400"
              : "text-rose-400"
          }
        />
        <MetricItem
          icon={<BarChart3 className="w-3 h-3" />}
          label="Piyasa Durumu"
          value={metrics.marketCondition}
          color="text-amber-400"
        />
        <MetricItem
          icon={<ShieldAlert className="w-3 h-3" />}
          label="Risk Seviyesi"
          value={metrics.riskLevel}
          color={
            metrics.riskLevel.includes("Düşük")
              ? "text-emerald-400"
              : "text-cyan-400"
          }
        />
        <MetricItem
          icon={<TrendingUp className="w-3 h-3" />}
          label="Trend Olasılığı"
          value={metrics.trendProbability}
          color={
            metrics.trendProbability.includes("Yükseliş")
              ? "text-emerald-400"
              : metrics.trendProbability.includes("Düşüş")
                ? "text-rose-400"
                : "text-slate-400"
          }
        />
      </div>

      {/* Smart Money Section */}
      <div className="mt-1 p-2.5 rounded-xl bg-slate-950/40 border border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
              SMART MONEY SCORE
            </span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-black text-emerald-400 font-mono">
              {metrics.smartMoneyScore}
            </span>
            <span className="text-[8px] font-bold text-slate-600">/ 10</span>
          </div>
        </div>
        {/* Mini Progress Bar */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/20 to-emerald-500 transition-all duration-700"
            style={{
              width: `${(parseFloat(metrics.smartMoneyScore.toString()) / 10) * 100}%`,
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold text-slate-300 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {metrics.bullishBias}
        </div>
      </div>

      {/* Semantic Narrative Section */}
      <div className="mt-1 p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
          <Brain className="w-8 h-8 text-cyan-400" />
        </div>

        <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          {metrics.summaryTitle}
        </h4>

        <p className="text-[11px] font-medium text-slate-200 leading-relaxed italic">
          &ldquo;{metrics.summaryText}&rdquo;
        </p>
      </div>
    </div>
  );
};

const MetricItem = ({
  icon,
  label,
  value,
  color,
  isCenter,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  isCenter?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col gap-1 p-2 rounded-xl bg-slate-950/40 border border-white/5 hover:border-white/10 transition-colors shadow-sm",
      isCenter && "items-center text-center",
    )}
  >
    <div
      className={cn("flex items-center gap-1.5", isCenter && "justify-center")}
    >
      <div className="text-slate-500">{icon}</div>
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
        {label}
      </span>
    </div>
    <div className={cn("text-[10px] font-black truncate", color)}>{value}</div>
  </div>
);
