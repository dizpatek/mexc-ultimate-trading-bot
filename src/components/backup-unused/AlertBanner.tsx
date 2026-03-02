"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Bell, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertItem {
  id: string;
  type: "LONG" | "SHORT" | "WARNING" | "SYSTEM" | "INFO";
  icon: string;
  message: string;
  detail?: string;
  ts: number;
}

interface F4Signal {
  systemDecision?: string;
  signal?: string;
  whaleDetected?: boolean;
  whaleSignalText?: string;
  deathRisk?: boolean;
  confluenceScore?: number;
  prediction?: { upProb?: number; text?: string; direction?: string };
  marketRegime?: string;
  volatilityRegime?: string;
  v5Indicators?: Array<{ name: string; state: string; color: string; capitalFlowText?: string; }>;
  mtfConsensus?: string;
  adm?: { classification?: number; evidence?: string };
  vpa?: { netPressure?: number };
  momentumState?: string;
  error?: string;
}

function evalAlerts(d: F4Signal): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = Date.now();

  if (d.systemDecision === "GO_LONG") {
    alerts.push({ id: "giga-long", type: "LONG", icon: "🚀", message: "GIGA ENGINE: AL SİNYALİ!", detail: `Confluence & AI Onaylı • Skor: ${d.confluenceScore ?? 0}/100`, ts: now });
  }
  if (d.systemDecision === "GO_SHORT") {
    alerts.push({ id: "giga-short", type: "SHORT", icon: "💀", message: "GIGA ENGINE: SAT SİNYALİ!", detail: `Confluence & AI Onaylı • Skor: ${d.confluenceScore ?? 0}/100`, ts: now });
  }
  if (d.deathRisk) {
    alerts.push({ id: "kill-switch", type: "WARNING", icon: "🛑", message: "KILL SWITCH AKTİF", detail: "Ardışık kayıp limiti aşıldı — İşlem durduruldu!", ts: now });
  }
  if (d.whaleDetected && d.signal === "BUY") {
    alerts.push({ id: "whale-long", type: "LONG", icon: "🐋", message: "BALİNA ALIŞ SİNYALİ", detail: d.whaleSignalText || "Tüm filtreler geçildi", ts: now });
  }
  if (d.whaleDetected && d.signal === "SELL") {
    alerts.push({ id: "whale-short", type: "SHORT", icon: "🐋", message: "BALİNA SATIŞ SİNYALİ", detail: d.whaleSignalText || "Tüm filtreler geçildi", ts: now });
  }
  if (d.marketRegime === "RISK_ON") {
    alerts.push({ id: "regime-on", type: "LONG", icon: "🌍", message: "PİYASA: LONG UYGUN", detail: "Risk-On rejimi aktif", ts: now });
  }
  if (d.marketRegime === "RISK_OFF") {
    alerts.push({ id: "regime-off", type: "SHORT", icon: "🌍", message: "PİYASA: SHORT UYGUN", detail: "Risk-Off rejimi aktif", ts: now });
  }
  if (d.volatilityRegime === "PATLAMA") {
    alerts.push({ id: "vol-explosion", type: "WARNING", icon: "💥", message: "VOLATİLİTE PATLAMASI", detail: "Sıkıştırmadan çıkış — Dikkat!", ts: now });
  }
  if ((d.confluenceScore ?? 0) >= 70) {
    alerts.push({ id: "score-high", type: "INFO", icon: "📈", message: `AI SKOR %${d.confluenceScore} — YÜK EŞÜSTÜ`, detail: "İşlem koşulları güçlü", ts: now });
  }
  if ((d.adm?.classification ?? 0) >= 2) {
    alerts.push({ id: "adm-bull", type: "LONG", icon: "📐", message: "ADM: Pozitif İstatistiksel Sapma", detail: `Kanıt: ${d.adm?.evidence || "—"} (Bullish Drift)`, ts: now });
  }
  if ((d.adm?.classification ?? 0) <= -2) {
    alerts.push({ id: "adm-bear", type: "SHORT", icon: "📐", message: "ADM: Negatif İstatistiksel Sapma", detail: `Kanıt: ${d.adm?.evidence || "—"} (Bearish Drift)`, ts: now });
  }
  if ((d.vpa?.netPressure ?? 0) > 50) {
    alerts.push({ id: "vpa-buy", type: "LONG", icon: "💧", message: "VPA: %50+ Net Alım Baskısı!", detail: `Net Basınç: ${d.vpa?.netPressure?.toFixed(1)}%`, ts: now });
  }
  if ((d.vpa?.netPressure ?? 0) < -50) {
    alerts.push({ id: "vpa-sell", type: "SHORT", icon: "💧", message: "VPA: %50+ Net Satım Baskısı!", detail: `Net Basınç: ${d.vpa?.netPressure?.toFixed(1)}%`, ts: now });
  }

  // V5 Indicator alerts
  (d.v5Indicators ?? []).forEach((ind) => {
    if (ind.name === "RSI" && ind.state === "AŞIRI SATIM") {
      alerts.push({ id: "rsi-os", type: "LONG", icon: "📉", message: "RSI Aşırı Satım!", detail: `RSI aşırı satım bölgesinde — Dönüş potansiyeli`, ts: now });
    }
    if (ind.name === "RSI" && ind.state === "AŞIRI ALIM") {
      alerts.push({ id: "rsi-ob", type: "SHORT", icon: "📈", message: "RSI Aşırı Alım!", detail: `RSI aşırı alım bölgesinde — Dikkat!`, ts: now });
    }
    if (ind.name === "MACD" && ind.state.includes("GÜÇLÜ BOĞA")) {
      alerts.push({ id: "macd-x-up", type: "LONG", icon: "✅", message: "MACD Güçlü Boğa!", detail: "Histogram büyüyor, yukarı momentum güçlü", ts: now });
    }
    if (ind.name === "Supertrend" && ind.state === "YUKARI TREND") {
      alerts.push({ id: "st-up", type: "LONG", icon: "⬆️", message: "Supertrend Yukarı Dönüş!", detail: "Trend yönü pozitife döndü", ts: now });
    }
    if (ind.name === "EMA Ribbon" && ind.state.includes("TAM HIZALANMA ↑")) {
      alerts.push({ id: "ema-bull", type: "LONG", icon: "🌈", message: "EMA Ribbon: Tam Boğa Hizalaması!", detail: "EMA 8>13>21>34>55 tam sıralama", ts: now });
    }
  });

  if (alerts.length === 0) {
    alerts.push({ id: "standby", type: "INFO", icon: "📡", message: "MATRIX V5 STANDBY", detail: `${d.mtfConsensus ?? "MTF analiz bekleniyor"} • Momentum: ${d.momentumState ?? "—"}`, ts: now });
  }

  return alerts;
}

const TYPE_CONFIG: Record<AlertItem["type"], { bg: string; border: string; text: string; badge: string }> = {
  LONG:    { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-300", badge: "bg-emerald-500" },
  SHORT:   { bg: "bg-rose-500/10",    border: "border-rose-500/30",    text: "text-rose-300",    badge: "bg-rose-500"    },
  WARNING: { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-300",   badge: "bg-amber-500"   },
  SYSTEM:  { bg: "bg-purple-500/10",  border: "border-purple-500/30",  text: "text-purple-300",  badge: "bg-purple-500"  },
  INFO:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-300",    badge: "bg-cyan-500"    },
};

export function AlertBanner() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAndEval = useCallback(async () => {
    try {
      const res = await fetch("/api/indicators/f4?symbol=BTCUSDT&interval=4h");
      const data: F4Signal = await res.json();
      if (!data.error) {
        const newAlerts = evalAlerts(data).filter((a) => !dismissed.has(a.id));
        setAlerts(newAlerts);
        setActiveIdx(0);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [dismissed]);

  useEffect(() => {
    fetchAndEval();
    const id = setInterval(fetchAndEval, 30000);
    return () => clearInterval(id);
  }, [fetchAndEval]);

  // Auto-cycle alerts
  useEffect(() => {
    if (alerts.length <= 1) return;
    timerRef.current = setInterval(() => {
      setActiveIdx((i: number) => (i + 1) % alerts.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [alerts]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));
  const active = visibleAlerts[activeIdx % Math.max(visibleAlerts.length, 1)];
  const criticalAlerts = visibleAlerts.filter((a) => a.type === "WARNING");
  const longAlerts = visibleAlerts.filter((a) => a.type === "LONG").length;
  const shortAlerts = visibleAlerts.filter((a) => a.type === "SHORT").length;

  if (loading) {
    return (
      <div className="w-full h-9 bg-slate-900/50 border border-slate-800/50 rounded-lg flex items-center px-4 gap-2 animate-pulse">
        <Activity className="w-3 h-3 text-cyan-500/50 animate-spin" />
        <span className="text-[10px] text-slate-600 tracking-widest font-bold">MATRIX V5 ALERT SİSTEMİ YÜKLENİYOR...</span>
      </div>
    );
  }

  if (!active) return null;

  const cfg = TYPE_CONFIG[active.type];

  return (
    <div className={cn(
      "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-700",
      cfg.bg, cfg.border
    )}>
      {/* Left: Kill switch warning pulsing */}
      {criticalAlerts.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="text-[9px] font-black text-rose-400 tracking-widest hidden sm:block">UYARI</span>
        </div>
      )}

      {/* Icon */}
      <span className="text-base leading-none shrink-0">{active.icon}</span>

      {/* Message */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("text-[11px] font-black tracking-wide shrink-0", cfg.text)}>{active.message}</span>
        {active.detail && (
          <span className="text-[10px] text-slate-500 truncate hidden md:block">{active.detail}</span>
        )}
      </div>

      {/* Stats pills */}
      <div className="flex items-center gap-1.5 shrink-0">
        {longAlerts > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] text-emerald-400 font-bold">
            <TrendingUp className="w-2.5 h-2.5" />{longAlerts}
          </span>
        )}
        {shortAlerts > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded text-[9px] text-rose-400 font-bold">
            <TrendingDown className="w-2.5 h-2.5" />{shortAlerts}
          </span>
        )}

        {/* Badge count */}
        {visibleAlerts.length > 1 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-400 font-bold">
            <Bell className="w-2.5 h-2.5" />{activeIdx + 1}/{visibleAlerts.length}
          </span>
        )}

        {/* Nav dots */}
        {visibleAlerts.length > 1 && (
          <div className="hidden sm:flex gap-0.5">
            {visibleAlerts.slice(0, 6).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={cn("w-1.5 h-1.5 rounded-full transition-all", i === activeIdx % visibleAlerts.length ? cfg.badge : "bg-slate-700")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Type icon */}
      <div className="shrink-0 hidden lg:flex">
        {active.type === "LONG" && <TrendingUp className="w-4 h-4 text-emerald-400" />}
        {active.type === "SHORT" && <TrendingDown className="w-4 h-4 text-rose-400" />}
        {active.type === "WARNING" && <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />}
        {active.type === "SYSTEM" && <Shield className="w-4 h-4 text-purple-400" />}
        {active.type === "INFO" && <Zap className="w-4 h-4 text-cyan-400" />}
      </div>
    </div>
  );
}
