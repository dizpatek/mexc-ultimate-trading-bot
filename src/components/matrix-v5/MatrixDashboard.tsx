"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Brain,
  Globe,
  Activity,
  Cpu,
  BarChart2,
  Fish,
} from "lucide-react";
import { fetchGlobalMarketData } from "@/lib/market-data";
import { api } from "@/services/api";

// ─── TYPES ───────────────────────────────────────────────────────────────────

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
interface Prediction {
  upProb: number;
  downProb: number;
  text: string;
  direction: "UP" | "DOWN" | "FLAT";
}
interface V5Data {
  // GIGA Engine
  confluenceScore: number;
  confluenceBreakdown: ConfBreakdown;
  prediction: Prediction;
  systemDecision: "GO_LONG" | "GO_SHORT" | "WAIT";
  deathRisk: boolean;
  metaAllow: boolean;
  // ADM / VPA
  adm: {
    classification: number;
    evidence: string;
    bias: string;
    direction: number;
  };
  vpa: {
    buyVolume: number;
    sellVolume: number;
    delta: number;
    netPressure: number;
    state: string;
  };
  // Technical
  swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  wt1?: number;
  wt2?: number;
  wtDivergence?: "BULLISH" | "BEARISH" | null;
  momentumState: string;
  // V5 Indicators
  v5Indicators: V5Indicator[];
  // Market data
  btcDominance: number;
  btcDomChange: number;
  usdtDominance: number;
  usdtDomChange: number;
  othersDominance: number;
  othersDomChange: number;
  marketFlow: string;
  marketPhaseText: string;
  capitalFlowText: string;
  // Whale
  whaleDetected: boolean;
  whaleSignalText: string;
  marketRegime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  regimePrediction: string;
  capitalPhase: string;
  crossAssetPermission?: boolean;
  signalFreshness?: number;
  whaleTrust?: number;
  // Engineering
  mtfConsensus: string;
  mtfBullCount: number;
  volatilityRegime: string;
  zScoreValue: number;
  bayesianWinRate?: number;
  error?: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 70 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-rose-400";

const scoreBg = (s: number) =>
  s >= 70 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-rose-500";

const indicatorColor = (c: V5Indicator["color"]) =>
  ({
    green: "bg-emerald-500",
    red: "bg-rose-500",
    orange: "bg-amber-500",
    gray: "bg-slate-600",
  })[c];

const indicatorText = (c: V5Indicator["color"]) =>
  ({
    green: "text-emerald-400",
    red: "text-rose-400",
    orange: "text-amber-400",
    gray: "text-slate-500",
  })[c];

const domArrow = (change: number) => (change > 0 ? "▲" : "▼");
const domColor = (change: number) =>
  change > 0 ? "text-emerald-400" : "text-rose-400";

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

const SectionHeader = ({
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
      "flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-800/60 text-[10px] font-bold tracking-widest uppercase",
      color,
    )}
  >
    <span className="opacity-60 w-3.5 h-3.5 shrink-0">{icon}</span>
    {title}
  </div>
);

const Row = ({
  label,
  value,
  valueClass = "text-slate-300",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  sub?: string;
}) => (
  <div className="flex items-start justify-between text-[10px] py-1 border-b border-white/5 last:border-0 gap-2">
    <span className="text-slate-500 shrink-0">{label}</span>
    <div className="text-right">
      <span className={cn("font-mono font-bold", valueClass)}>{value}</span>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  </div>
);

const Bar = ({
  value,
  color = "bg-cyan-500",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) => (
  <div className="space-y-0.5">
    {label && (
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(0)}%</span>
      </div>
    )}
    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

const Dot = ({ color }: { color: string }) => (
  <span className={cn("w-1.5 h-3 rounded-sm shrink-0", color)} />
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export const MatrixDashboard = () => {
  const [data, setData] = useState<V5Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [btcdVal, setBtcdVal] = useState(0);
  const [usdtdVal, setUsdtdVal] = useState(0);
  const [othersVal, setOthersVal] = useState(0);
  const [marketFlow, setMarketFlow] = useState("—");

  const refresh = useCallback(async () => {
    try {
      const [resData, marketData] = await Promise.all([
        api.get("/indicators/f4?symbol=BTCUSDT&interval=4h").then((r) => r.data),
        fetchGlobalMarketData().catch(() => null),
      ]);
      if (resData && !resData.error) setData(resData);
      if (marketData) {
        setBtcdVal(marketData.btcd?.value ?? 0);
        setUsdtdVal(marketData.usdtd?.value ?? 0);
        setOthersVal(marketData.othersd?.value ?? 0);
        setMarketFlow(marketData.flow ?? "—");
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading)
    return (
      <div className="w-full h-32 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
        <span className="text-[10px] text-slate-500 font-bold tracking-widest">
          MATRIX V5 DATA SYNC...
        </span>
      </div>
    );

  // ── Derived display values ────────────────────────────────────────────────
  const d = data;
  const score = d?.confluenceScore ?? 0;
  const upProb = d?.prediction?.upProb ?? 50;
  const downProb = d?.prediction?.downProb ?? 50;

  const sysText =
    d?.systemDecision === "GO_LONG"
      ? "İŞLEM AÇ (LONG) ✅"
      : d?.systemDecision === "GO_SHORT"
        ? "İŞLEM AÇ (SHORT) ✅"
        : "BEKLE ❌";
  const sysClass =
    d?.systemDecision === "GO_LONG"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
      : d?.systemDecision === "GO_SHORT"
        ? "text-rose-400 border-rose-500/30 bg-rose-500/5"
        : "text-slate-400 border-slate-600/30 bg-slate-800/20";

  const structureText =
    d?.swingTrend === "BULLISH"
      ? "Boğa Trendi 📈"
      : d?.swingTrend === "BEARISH"
        ? "Ayı Trendi 📉"
        : "Yatay/Nötr ➡️";
  const structureClass =
    d?.swingTrend === "BULLISH"
      ? "text-emerald-400"
      : d?.swingTrend === "BEARISH"
        ? "text-rose-400"
        : "text-slate-400";

  const regimeText =
    d?.marketRegime === "RISK_ON"
      ? "Long Uygun 🟢"
      : d?.marketRegime === "RISK_OFF"
        ? "Short Uygun 🔴"
        : "Bekle (Nötr) ⚪";
  const regimeClass =
    d?.marketRegime === "RISK_ON"
      ? "text-emerald-400"
      : d?.marketRegime === "RISK_OFF"
        ? "text-rose-400"
        : "text-slate-400";

  const capText =
    d?.capitalPhase === "PRIMARY_FLOW"
      ? "Ana Akış (Güçlü) 💰"
      : d?.capitalPhase === "SECONDARY_FLOW"
        ? "İkincil Akış"
        : d?.capitalPhase === "ROTATION"
          ? "Rotasyon 🔄"
          : "Para Yok ❌";
  const capClass =
    d?.capitalPhase === "PRIMARY_FLOW" || d?.capitalPhase === "SECONDARY_FLOW"
      ? "text-emerald-400"
      : "text-rose-400";

  const freshText = (d?.signalFreshness ?? 99) <= 5 ? "TAZE ✅" : "BAYAT ❌";
  const freshClass =
    (d?.signalFreshness ?? 99) <= 5 ? "text-emerald-400" : "text-amber-400";

  const healthText =
    (d?.whaleTrust ?? 0) > 1
      ? "MÜKEMMEL 💪"
      : (d?.whaleTrust ?? 0) > 0.6
        ? "GÜÇLÜ ✅"
        : "RİSKLİ ⚠️";
  const healthClass =
    (d?.whaleTrust ?? 0) > 0.6 ? "text-emerald-400" : "text-amber-400";

  const divText =
    d?.wtDivergence === "BULLISH"
      ? "Pozitif (Dönüş) 🔄"
      : d?.wtDivergence === "BEARISH"
        ? "Negatif (Dönüş) 🔄"
        : "Yok";
  const divClass =
    d?.wtDivergence === "BULLISH"
      ? "text-emerald-400"
      : d?.wtDivergence === "BEARISH"
        ? "text-rose-400"
        : "text-slate-500";

  const winRate = d?.bayesianWinRate ?? Math.floor(score * 0.8);

  // V5 indicators map by name for quick lookup
  const indMap: Record<string, V5Indicator> = {};
  (d?.v5Indicators ?? []).forEach((i) => {
    indMap[i.name] = i;
  });

  return (
    <div className="w-full font-sans">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800/50 ">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-500" />
          <span className="text-[11px] font-black text-slate-300 tracking-widest uppercase">
            MATRIX GIGA MASTER ENGINE
          </span>
          <span className="text-[9px] text-slate-600 font-mono">V5.0</span>
        </div>
        <button
          onClick={refresh}
          className="p-1 text-slate-600 hover:text-cyan-400 transition-colors"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        </button>
      </div>

      {/* ── 6-Column Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-0 divide-x divide-slate-800/40">
        {/* ══════════════════════════════════════════ */}
        {/* COL 1: 🧠 GIGA ENGINE                      */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-2">
          <SectionHeader
            icon={<Brain size={12} />}
            title="GIGA ENGINE"
            color="text-cyan-400"
          />

          {/* Score Ring */}
          <div className="flex flex-col items-center py-2">
            <div
              className={cn(
                "text-3xl font-black font-mono leading-none",
                scoreColor(score),
              )}
            >
              {score}
            </div>
            <div className="text-[8px] text-slate-600 font-bold tracking-widest mt-0.5">
              / 100 AI SKOR
            </div>
            <div className="w-full mt-2">
              <Bar value={score} color={scoreBg(score)} />
            </div>
          </div>

          <Row
            label="Confluence"
            value={`${d?.confluenceBreakdown?.totalScore ?? score}/100`}
            valueClass={scoreColor(score)}
            sub={d?.confluenceBreakdown?.status}
          />
          <Row
            label="Tahmin"
            value={`${d?.prediction?.text ?? "—"} (${upProb.toFixed(0)}%)`}
            valueClass={
              upProb >= 60
                ? "text-emerald-400"
                : downProb >= 60
                  ? "text-rose-400"
                  : "text-slate-400"
            }
          />

          {/* System Decision */}
          <div
            className={cn(
              "mt-2 w-full text-center py-2 rounded border text-[10px] font-black animate-pulse tracking-wider",
              sysClass,
            )}
          >
            {sysText}
          </div>

          {/* sub-scores mini */}
          {d?.confluenceBreakdown && (
            <div className="space-y-1 pt-1">
              <Bar
                value={d.confluenceBreakdown.techScore}
                color="bg-cyan-500"
                label="Teknik"
              />
              <Bar
                value={d.confluenceBreakdown.momentumScore}
                color="bg-violet-500"
                label="Momentum"
              />
              <Bar
                value={d.confluenceBreakdown.volumeScore}
                color="bg-amber-500"
                label="Hacim"
              />
              <Bar
                value={d.confluenceBreakdown.trendScore}
                color="bg-emerald-500"
                label="Trend"
              />
              <Bar
                value={d.confluenceBreakdown.marketScore}
                color="bg-rose-500"
                label="Piyasa"
              />
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* COL 2: 🔬 ADM / VPA + TEKNİK               */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-2">
          <SectionHeader
            icon={<Activity size={12} />}
            title="İleri Analiz"
            color="text-violet-400"
          />

          <Row
            label="ADM (Z-Drift)"
            value={`${d?.adm?.bias ?? "—"} (${d?.adm?.evidence ?? "YOK"})`}
            valueClass={
              (d?.adm?.classification ?? 0) > 0
                ? "text-emerald-400"
                : (d?.adm?.classification ?? 0) < 0
                  ? "text-rose-400"
                  : "text-slate-400"
            }
          />
          <Row
            label="VPA Basıncı"
            value={`${(d?.vpa?.netPressure ?? 0).toFixed(1)}%`}
            valueClass={
              (d?.vpa?.netPressure ?? 0) > 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
          />

          {/* VPA Bars */}
          {d?.vpa && (
            <div className="space-y-1 py-1">
              <div className="flex gap-1 text-[9px]">
                <div className="flex-1">
                  <div className="text-slate-600 mb-0.5">Alım</div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/70 rounded-full"
                      style={{
                        width: `${Math.min(100, (d.vpa.buyVolume / (d.vpa.buyVolume + d.vpa.sellVolume + 0.001)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-slate-600 mb-0.5">Satım</div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500/70 rounded-full"
                      style={{
                        width: `${Math.min(100, (d.vpa.sellVolume / (d.vpa.buyVolume + d.vpa.sellVolume + 0.001)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <Row
                label="VPA Durumu"
                value={d.vpa.state}
                valueClass="text-cyan-300"
              />
            </div>
          )}

          <div className="pt-1">
            <SectionHeader
              icon={<BarChart2 size={12} />}
              title="Teknik (SMC)"
              color="text-amber-400"
            />
            <Row
              label="Yapı (SMC)"
              value={structureText}
              valueClass={structureClass}
            />
            <Row
              label="F4 Eğilimi"
              value={
                d?.trend === "BULLISH"
                  ? "Yükseliyor 📈"
                  : d?.trend === "BEARISH"
                    ? "Düşüyor 📉"
                    : "Nötr ➡️"
              }
              valueClass={
                d?.trend === "BULLISH"
                  ? "text-emerald-400"
                  : d?.trend === "BEARISH"
                    ? "text-rose-400"
                    : "text-slate-400"
              }
            />
            <Row
              label="Momentum"
              value={d?.momentumState ?? "—"}
              valueClass="text-cyan-400"
            />
            <Row label="Uyumsuzluk" value={divText} valueClass={divClass} />
          </div>
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* COL 3: 📊 V5 INDICATORS                   */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-1">
          <SectionHeader
            icon={<BarChart2 size={12} />}
            title="V5 İndikatörler"
            color="text-emerald-400"
          />

          {/* Spark row */}
          <div className="flex gap-0.5 mb-2 py-1">
            {(d?.v5Indicators ?? []).map((ind, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${ind.name}: ${ind.state} (${ind.value})`}
              >
                <Dot color={indicatorColor(ind.color)} />
                <span className="text-[7px] text-slate-600 truncate w-full text-center">
                  {ind.name.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>

          {/* Full indicator rows */}
          {d?.v5Indicators?.map((ind) => (
            <div
              key={ind.name}
              className="flex items-center justify-between text-[10px] py-0.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    indicatorColor(ind.color),
                  )}
                />
                <span className="text-slate-500">{ind.name}</span>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "font-mono font-bold text-[10px]",
                    indicatorText(ind.color),
                  )}
                >
                  {ind.state}
                </span>
                {ind.value && (
                  <span className="text-[9px] text-slate-600 ml-1">
                    ({ind.value})
                  </span>
                )}
              </div>
            </div>
          ))}

          {(!d?.v5Indicators || d.v5Indicators.length === 0) && (
            <div className="text-slate-600 text-[10px] text-center py-4">
              VERİ BEKLENİYOR...
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* COL 4: 🌐 MARKET DATA                     */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-2">
          <SectionHeader
            icon={<Globe size={12} />}
            title="Piyasa Verileri"
            color="text-blue-400"
          />

          {/* Dominance bars */}
          {[
            {
              label: "BTC.DOM",
              val: btcdVal || d?.btcDominance || 0,
              chg: d?.btcDomChange ?? 0,
              color: "bg-amber-500",
            },
            {
              label: "USDT.DOM",
              val: usdtdVal || d?.usdtDominance || 0,
              chg: d?.usdtDomChange ?? 0,
              color: "bg-cyan-500",
            },
            {
              label: "OTHERS.D",
              val: othersVal || d?.othersDominance || 0,
              chg: d?.othersDomChange ?? 0,
              color: "bg-rose-500",
            },
          ].map(({ label, val, chg, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-500">
                  {label}{" "}
                  <span className={domColor(chg)}>
                    {domArrow(chg)}
                    {Math.abs(chg).toFixed(2)}%
                  </span>
                </span>
                <span className="font-mono font-bold text-slate-300">
                  {val.toFixed(1)}%
                </span>
              </div>
              <Bar value={val} color={color} />
            </div>
          ))}

          <div className="mt-2 p-2 bg-slate-900/40 rounded border border-slate-700/20 text-center">
            <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1">
              Piyasa Akışı
            </div>
            <div className="text-[11px] font-bold text-emerald-400">
              {marketFlow || d?.marketFlow || "—"}
            </div>
          </div>

          <Row
            label="Döngü"
            value={d?.marketPhaseText ?? "—"}
            valueClass="text-cyan-300"
          />
          <Row
            label="Para Akışı"
            value={d?.capitalFlowText ?? "—"}
            valueClass={capClass}
          />
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* COL 5: 🐋 WHALE & REJİM                  */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-1">
          <SectionHeader
            icon={<Fish size={12} />}
            title="Whale Engine"
            color="text-teal-400"
          />

          {/* Whale status badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-bold mb-2",
              d?.whaleDetected
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-slate-800/30 border-slate-700/20 text-slate-500",
            )}
          >
            <Fish className="w-3 h-3 shrink-0" />
            {d?.whaleDetected
              ? d.whaleSignalText || "WHALE TESPİT EDİLDİ 🐳"
              : "Balina Aktivitesi Yok"}
          </div>

          <Row
            label="Piyasa Rejimi"
            value={regimeText}
            valueClass={regimeClass}
          />
          <Row
            label="Gelecek Tahmin"
            value={d?.regimePrediction?.replace(/_/g, " ") ?? "—"}
            valueClass="text-amber-300"
          />
          <Row label="Sermaye Yönü" value={capText} valueClass={capClass} />
          <Row
            label="BTC Onayı"
            value={d?.crossAssetPermission ? "ONAYLI ✅" : "BEKLE ❌"}
            valueClass={
              d?.crossAssetPermission ? "text-emerald-400" : "text-slate-400"
            }
          />
          <Row
            label="Sinyal Tazeliği"
            value={freshText}
            valueClass={freshClass}
          />
          <Row
            label="Modül Sağlığı"
            value={healthText}
            valueClass={healthClass}
          />

          {/* Kill switch indicator */}
          {d?.deathRisk && (
            <div className="mt-2 w-full py-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-center text-[10px] font-black text-rose-400 animate-pulse">
              🛑 KILL SWITCH AKTİF
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════ */}
        {/* COL 6: ⚙️ MÜHENDİSLİK ANALİZİ            */}
        {/* ══════════════════════════════════════════ */}
        <div className="p-3 space-y-1">
          <SectionHeader
            icon={<Cpu size={12} />}
            title="Mühendislik"
            color="text-purple-400"
          />

          <Row
            label="MTF Uzlaşı"
            value={d?.mtfConsensus ?? "—"}
            valueClass={
              (d?.mtfBullCount ?? 0) >= 4
                ? "text-emerald-400"
                : (d?.mtfBullCount ?? 0) <= 1
                  ? "text-rose-400"
                  : "text-amber-400"
            }
          />

          {/* MTF bar 5TF */}
          <div className="flex gap-0.5 my-1.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-2 rounded-sm transition-all duration-500",
                  i < (d?.mtfBullCount ?? 0)
                    ? "bg-emerald-500"
                    : "bg-slate-700",
                )}
                title={`TF ${i + 1}`}
              />
            ))}
          </div>

          <Row
            label="Momentum İvme"
            value={d?.momentumState ?? "—"}
            valueClass="text-cyan-400"
          />
          <Row
            label="Volatilite"
            value={d?.volatilityRegime ?? "—"}
            valueClass={
              d?.volatilityRegime === "PATLAMA"
                ? "text-purple-400 animate-pulse"
                : d?.volatilityRegime === "YÜKSEK_VOL"
                  ? "text-amber-400"
                  : "text-slate-400"
            }
          />
          <Row
            label="Z-Skor"
            value={(d?.zScoreValue ?? 0).toFixed(2)}
            valueClass={
              Math.abs(d?.zScoreValue ?? 0) > 2
                ? "text-rose-400"
                : Math.abs(d?.zScoreValue ?? 0) > 1
                  ? "text-amber-400"
                  : "text-emerald-400"
            }
          />

          {/* Win Rate */}
          <div className="mt-3 p-2.5 bg-slate-900/40 border border-slate-700/20 rounded">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 text-center">
              BAŞARI OLASILIĞI
            </div>
            <div
              className={cn(
                "text-2xl font-black text-center font-mono",
                scoreColor(winRate),
              )}
            >
              %{winRate}
            </div>
            <div className="mt-2">
              <Bar value={winRate} color={scoreBg(winRate)} />
            </div>
          </div>

          {/* Final decision mini */}
          <div
            className={cn(
              "mt-2 text-center py-1.5 rounded border text-[10px] font-black",
              sysClass,
            )}
          >
            {sysText}
          </div>

          {/* Prediction probability */}
          <div className="flex gap-1 mt-1.5">
            <div className="flex-1 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded text-center">
              <div className="text-[8px] text-slate-600">YUKARI</div>
              <div className="text-[11px] font-black text-emerald-400 font-mono">
                {upProb.toFixed(0)}%
              </div>
            </div>
            <div className="flex-1 py-1 bg-rose-500/5 border border-rose-500/10 rounded text-center">
              <div className="text-[8px] text-slate-600">AŞAĞI</div>
              <div className="text-[11px] font-black text-rose-400 font-mono">
                {downProb.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 mt-1">
            <div className="flex-1 text-[8px] font-bold bg-rose-500/5 text-rose-400 py-1 rounded text-center border border-rose-500/10">
              KILL SW: {d?.deathRisk ? "AKTİF 🛑" : "OK ✅"}
            </div>
            <div className="flex-1 text-[8px] font-bold bg-emerald-500/5 text-emerald-400 py-1 rounded text-center border border-emerald-500/10">
              V5 ENGINE: ✅
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
