"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SmartTradeOrder } from "../ActiveSmartTrades";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { api } from "@/services/api";
import {
  synthesizeActivityLog,
  formatLiveDuration,
  calculateDrawdown,
  calculateRiskReward,
  type ActivityLogEntry,
  type F4Live,
} from "@/lib/trade-activity-log";
import {
  Clock,
  ZapOff,
  ExternalLink,
  TrendingUp,
  Zap,
  RefreshCw,
  Target,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  LayoutGrid,
  ScrollText,
  Gamepad2,
  Archive,
} from "lucide-react";

import { useNotification } from "@/context/NotificationContext";

interface ExpandedTradePanelProps {
  trade: SmartTradeOrder;
  currentPrice: number;
  isClosed: boolean;
  meta: SmartTradeOrder["meta"];
  entry: number;
  aiScore: number;
  statusText: string;
  statusColor?: string;
  tp: number;
  sl: number;
  payload: SmartTradeOrder["meta"]["payload"];
  pnlPercent: number;
  pnlUsdt: number;
  onEdit?: (trade: SmartTradeOrder) => void;
  handlePanicClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  handleSilentClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  handleFlashOpen: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  fetchTrades: () => void;
  isTtpActive?: boolean;
  isTslActive?: boolean;
  liveData?: F4Live | null;
  mtfVerdictText?: string;
  bullCount?: number;
  bearCount?: number;
}

export const ExpandedTradePanel: React.FC<ExpandedTradePanelProps> = ({
  trade,
  currentPrice,
  isClosed,
  meta,
  entry,
  aiScore,
  statusText,
  statusColor,
  tp,
  sl,
  payload,
  pnlPercent,
  pnlUsdt,
  onEdit,
  handlePanicClose,
  handleSilentClose,
  handleFlashOpen,
  fetchTrades,
  isTtpActive = false,
  isTslActive = false,
  liveData = null,
  mtfVerdictText,
  bullCount,
  bearCount,
}) => {
  const { notify, confirm } = useNotification();
  const [liveDuration, setLiveDuration] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [isEditingSl, setIsEditingSl] = useState(false);
  const [newSlValue, setNewSlValue] = useState(sl.toString());

  const mode = meta.mode || "TRADE";
  const isTradeMode = mode === "TRADE";

  // Hook: Live duration timer
  useEffect(() => {
    const u = () => setLiveDuration(formatLiveDuration(trade.created_at));
    u();
    if (!isClosed) {
      const i = setInterval(u, 1000);
      return () => clearInterval(i);
    }
  }, [trade.created_at, isClosed]);

  // Hook: Synthesize activity logs
  useEffect(() => {
    setActivityLogs(
      synthesizeActivityLog(
        trade,
        currentPrice,
        tp,
        sl,
        aiScore,
        statusText,
        isTtpActive,
        isTslActive,
        liveData,
        mtfVerdictText,
        bullCount,
        bearCount,
      ),
    );
  }, [
    trade,
    currentPrice,
    tp,
    sl,
    aiScore,
    statusText,
    isTtpActive,
    isTslActive,
    liveData,
    mtfVerdictText,
    bullCount,
    bearCount,
  ]);

  // Hook: Core action logic
  const doAction = useCallback(
    async (id: string, label: string, msg: string, fn: () => Promise<void>) => {
      confirm({
        message: msg,
        onConfirm: async () => {
          setLoadingAction(id);
          try {
            await fn();
            logger.success(`✅ ${label}`, `${trade.symbol} başarılı.`);
          } catch (e: unknown) {
            const m = e instanceof Error ? e.message : String(e);
            logger.error(`❌ ${label}`, m);
            notify(`Hata: ${m}`, "error");
          } finally {
            setLoadingAction(null);
          }
        }
      });
    },
    [trade.symbol, notify, confirm],
  );

  const onTpTrigger = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      doAction(
        "tp",
        "TP TETİKLE",
        `TP Zorla Tetiklensin mi? (İşlem anlık fiyattan Kar Al ile kapatılacaktır)`,
        async () => {
          await api.put(`/trade/smart?id=${trade.id}`, { forceTp: true });
          fetchTrades();
        },
      );
    },
    [trade, currentPrice, doAction, fetchTrades],
  );

  const onSlSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const n = parseFloat(newSlValue);
      if (isNaN(n) || n <= 0) {
        notify("Geçersiz SL değeri!", "warning");
        return;
      }
      
      await doAction(
        "sl",
        "SL GÜNCELLE",
        `Stop Loss $${sl.toFixed(2)} → $${n.toFixed(2)} olarak güncellensin mi?`,
        async () => {
          await api.put(`/trade/smart?id=${trade.id}`, { updateSl: n });
          setIsEditingSl(false);
          fetchTrades();
        },
      );
    },
    [trade, sl, newSlValue, doAction, fetchTrades, notify],
  );

  return (
    <div
      className="border-t border-white/5 bg-slate-950/60 overflow-x-auto custom-scrollbar"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex divide-x divide-white/[0.04] bg-white/[0.04] min-w-[1200px]">
        {/* ── SEGMENT 1: LOGS (LEFT) ── */}
        <div className="w-[300px] shrink-0 border-r border-white/5">
          <LogSegment logs={activityLogs} isClosed={isClosed} />
        </div>

        {/* ── SEGMENT 2: STATS (CENTER) ── */}
        <div className="flex-1 min-w-[600px]">
          <StatSegment
            trade={trade}
            meta={meta}
            currentPrice={currentPrice}
            entry={entry}
            tp={tp}
            sl={sl}
            pnlPercent={pnlPercent}
            pnlUsdt={pnlUsdt}
            aiScore={aiScore}
            statusText={statusText}
            statusColor={statusColor}
            liveDuration={liveDuration}
            isClosed={isClosed}
            liveData={liveData}
          />
        </div>

        {/* ── SEGMENT 3: ACTIONS (RIGHT) ── */}
        <div className="w-[300px] shrink-0 border-l border-white/5">
          <ActionSegment
            trade={trade}
            isClosed={isClosed}
            isTradeMode={isTradeMode}
            loadingAction={loadingAction}
            payload={payload}
            onEdit={onEdit}
            onTpTrigger={onTpTrigger}
            onSlUpdate={() => {
              setNewSlValue(sl.toFixed(2));
              setIsEditingSl(true);
            }}
            isEditingSl={isEditingSl}
            newSlValue={newSlValue}
            setNewSlValue={setNewSlValue}
            onSlSave={onSlSave}
            onSlCancel={() => setIsEditingSl(false)}
            handlePanicClose={handlePanicClose}
            handleSilentClose={handleSilentClose}
            handleFlashOpen={handleFlashOpen}
            setLoadingAction={setLoadingAction}
            fetchTrades={fetchTrades}
            onDelegate={async (e) => {
              e.stopPropagation();
              await doAction(
                "delegate",
                "PİLOT'A DEVRET",
                `Bu işlem MEVCUT AYARLARINIZLA (TP/SL/Trailing) otopilot denetimine devredilsin mi? Manuel ayarlarınız korunacaktır.`,
                async () => {
                  await api.put(`/trade/delegate`, { orderId: trade.id });
                  fetchTrades();
                }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ═══ SUB-SEGMENT COMPONENTS ═══

interface LogSegmentProps {
  logs: ActivityLogEntry[];
  isClosed: boolean;
}
const LogSegment: React.FC<LogSegmentProps> = ({ logs }) => (
  <div className="flex flex-col bg-slate-950/40 relative">
    <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/5 bg-slate-950/80 sticky top-0 z-10">
      <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-1.5">
        <ScrollText className="w-2.5 h-2.5 text-cyan-400" />
        LOG
      </span>
      <span className="text-[7px] font-bold text-slate-700">
        {logs.length} EV
      </span>
    </div>
    <div className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {logs.length === 0 ? (
        <div className="py-12 text-center text-[10px] text-slate-700 font-bold uppercase animate-pulse">
          ANALİZ EDİLİYOR...
        </div>
      ) : (
        <div className="divide-y divide-white/[0.015]">
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 p-2 hover:bg-white/[0.02] transition-colors group/log"
            >
              <span className="text-[12px] leading-none pt-0.5 shrink-0 grayscale group-hover/log:grayscale-0 transition-all">
                {log.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-[10px] font-bold leading-tight",
                    log.color,
                  )}
                >
                  {log.message}
                </div>
                <div className="text-[8px] font-mono text-slate-600/60 mt-0.5 flex items-center gap-1">
                  <Clock className="w-1.5 h-1.5 shrink-0" />
                  {new Date(log.time).toLocaleTimeString([], { hour12: false })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
  </div>
);

interface StatSegmentProps {
  trade: SmartTradeOrder;
  meta: SmartTradeOrder["meta"];
  currentPrice: number;
  entry: number;
  tp: number;
  sl: number;
  pnlPercent: number;
  pnlUsdt: number;
  aiScore: number;
  statusText: string;
  statusColor?: string;
  liveDuration: string;
  isClosed: boolean;
  liveData?: F4Live | null;
}
const StatSegment: React.FC<StatSegmentProps> = ({
  trade,
  meta,
  currentPrice,
  entry,
  tp,
  sl,
  pnlPercent,
  pnlUsdt,
  aiScore,
  statusText,
  statusColor,
  liveDuration,
  isClosed,
  liveData,
}) => {
  const qty = trade.qty || parseFloat(meta.payload?.amount || "0") || 0;
  const entryVal = entry * qty;
  const curVal = currentPrice * qty;
  const dd = calculateDrawdown(
    entry,
    Number(meta.highestPrice) || entry,
    currentPrice,
    trade.side,
  );
  const rr = calculateRiskReward(entry, tp, sl, trade.side);
  const tpDist =
    tp > 0
      ? ((tp - currentPrice) / currentPrice) *
        100 *
        (trade.side === "BUY" ? 1 : -1)
      : 0;
  const slDist =
    sl > 0
      ? ((sl - currentPrice) / currentPrice) *
        100 *
        (trade.side === "BUY" ? -1 : 1)
      : 0;
  const hi = Number(meta.highestPrice) || entry;
  const lo = Number(meta.lowestPrice) || entry;

  // Helper to get v5 indicators
  const live = (liveData as F4Live) || {};
  const getInd = (name: string) =>
    live.v5Indicators?.find((i) => i.name === name);
  const rsi = getInd("RSI");
  const macd = getInd("MACD");
  const st = getInd("Supertrend");
  const ribbon = getInd("EMA Ribbon");

  return (
    <div className="flex flex-col bg-slate-950/40">
      <div className="px-2 py-1.5 flex items-center gap-1.5 border-b border-white/5 bg-slate-950/80">
        <LayoutGrid className="w-2.5 h-2.5 text-emerald-400" />
        <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">
          KONSOLİDE ANALİZ
        </span>
      </div>
      {isClosed ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03]">
          <T
            label="TETİK"
            value={
              meta.exitReason?.includes("MANUAL") ? "MANUEL" : "AI MONİTÖR"
            }
            color={
              meta.exitReason?.includes("MANUAL")
                ? "text-amber-400"
                : "text-emerald-400"
            }
          />
          <T
            label="SEBEP"
            value={
              meta.exitReason === "MANUAL_PANIC_EXIT"
                ? "PANİK"
                : meta.exitReason || "—"
            }
          />
          <T label="ÇIKIŞ" value={`$${currentPrice.toLocaleString()}`} />
          <T label="GİRİŞ" value={`$${entry.toLocaleString()}`} />
          <T label="SÜRE" value={liveDuration} color="text-cyan-300" />
          <T
            label="EMİR"
            value={meta.exitResult?.orderId?.slice(-6) || "INT"}
            color="text-cyan-500/60"
          />
          <div
            className={cn(
              "col-span-2 p-2 flex flex-col items-center justify-center",
              pnlPercent >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
            )}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  pnlPercent >= 0 ? "text-emerald-500" : "text-rose-500",
                )}
              />
              <span
                className={cn(
                  "text-lg font-black font-mono leading-none",
                  pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {pnlPercent >= 0 ? "+" : ""}
                {pnlPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03]">
          {/* ROW 1 */}
          <T label="MİKTAR" value={`${qty.toLocaleString()}`} />
          <T
            label="GİRİŞ"
            value={`$${entryVal.toFixed(1)}`}
            color="text-amber-400"
          />
          <T
            label="GÜNCEL"
            value={`$${curVal.toFixed(1)}`}
            color={pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <T
            label="AI GÜVEN"
            value={aiScore > 0 ? `${aiScore}%` : "…"}
            color={
              aiScore >= 60
                ? "text-emerald-400"
                : aiScore >= 40
                  ? "text-amber-400"
                  : "text-rose-400"
            }
          />

          {/* ROW 2: PNL */}
          <div
            className={cn(
              "col-span-2 p-2 flex flex-col justify-center",
              pnlPercent >= 0
                ? "bg-emerald-500/10 animate-pulse"
                : "bg-rose-500/10",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-lg font-black font-mono leading-none",
                  pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                ${pnlUsdt.toFixed(2)}
              </span>
              <span
                className={cn(
                  "text-xs font-black font-mono opacity-80",
                  pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                ({pnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <T label="SÜRE" value={liveDuration} color="text-cyan-300" pulse />
          <T
            label="DURUM"
            value={statusText}
            color={statusColor || "text-cyan-400"}
          />

          {/* ROW 3 */}
          <T
            label="TP UZA"
            value={
              tp > 0 ? `${tpDist >= 0 ? "+" : ""}${tpDist.toFixed(2)}%` : "—"
            }
            color="text-emerald-400"
          />
          <T
            label="SL UZA"
            value={sl > 0 ? `${slDist.toFixed(2)}%` : "—"}
            color="text-rose-400"
          />
          <T label="R / Ö" value={rr} color="text-cyan-300" />
          <T
            label="MAX DD"
            value={`${dd.toFixed(2)}%`}
            color={dd > 2 ? "text-rose-400" : "text-amber-400"}
          />

          {/* ROW 4 */}
          <T
            label="ZİRVE"
            value={`$${hi.toLocaleString()}`}
            color="text-emerald-300"
          />
          <T
            label="DİP"
            value={`$${lo.toLocaleString()}`}
            color="text-rose-300"
          />
          <T
            label="REJİM"
            value={live.marketRegime || "OFF"}
            color={
              live.marketRegime === "RISK_ON"
                ? "text-emerald-400"
                : "text-slate-500"
            }
          />
          <T
            label="VOLATL"
            value={live.volatilityRegime || "NEUTRAL"}
            color="text-amber-400"
          />

          {/* NEW ROW 5: 10 MORE TILES AS REQUESTED */}
          <T
            label="RSI (15M)"
            value={rsi?.value || "—"}
            color={rsi?.color === "red" ? "text-rose-400" : "text-emerald-400"}
          />
          <T
            label="MACD GÜÇ"
            value={macd?.state?.split(" ")[0] || "—"}
            color={macd?.color === "red" ? "text-rose-400" : "text-emerald-400"}
          />
          <T
            label="EMA RIB"
            value={ribbon?.state?.split(" ")[0] || "—"}
            color={
              ribbon?.color === "red" ? "text-rose-400" : "text-emerald-400"
            }
          />
          <T
            label="SUP TRND"
            value={st?.state || "—"}
            color={st?.color === "red" ? "text-rose-400" : "text-emerald-400"}
          />

          {/* ROW 6 */}
          <T
            label="Z-SCORE"
            value={live.zScoreValue?.toFixed(2) || "—"}
            color="text-cyan-400"
          />
          <T
            label="ADM BİAS"
            value={live.adm?.bias || "—"}
            color="text-amber-400"
          />
          <T
            label="LİKİDİTE"
            value={live.liquidityZone || "YOK"}
            color="text-violet-400"
          />
          <T
            label="VPA STAT"
            value={live.vpa?.state?.split(" ")[0] || "—"}
            color="text-cyan-300"
          />

          {/* ROW 7 */}
          <T
            label="WH TRUST"
            value={live.whaleTrust ? `${live.whaleTrust}%` : "—"}
            color="text-purple-400"
          />
          <T
            label="TF ADAPT"
            value={live.tfAdaptFactor ? `${live.tfAdaptFactor}x` : "—"}
            color="text-blue-400"
          />
          <T
            label="BUY VOL"
            value={
              live.vpa?.buyVolume
                ? `$${(live.vpa.buyVolume / 1000).toFixed(1)}k`
                : "—"
            }
            color="text-emerald-400"
          />
          <T
            label="SELL VOL"
            value={
              live.vpa?.sellVolume
                ? `$${(live.vpa.sellVolume / 1000).toFixed(1)}k`
                : "—"
            }
            color="text-rose-400"
          />

          {/* ROW 8: FUNDING RATES */}
          <T
            label="FONLAMA"
            value={live.fundingRate !== undefined ? `${(live.fundingRate * 100).toFixed(4)}%` : "—"}
            color={(live.fundingRate || 0) > 0 ? "text-rose-400" : "text-emerald-400"}
          />
          <T
            label="FON ETKİ"
            value={live.fundingImpact || "—"}
            color="text-amber-400"
          />
        </div>
      )}
    </div>
  );
};

interface ActionSegmentProps {
  trade: SmartTradeOrder;
  isClosed: boolean;
  isTradeMode: boolean;
  loadingAction: string | null;
  payload: SmartTradeOrder["meta"]["payload"];
  onEdit?: (trade: SmartTradeOrder) => void;
  onTpTrigger: (e: React.MouseEvent) => void;
  onSlUpdate: () => void;
  isEditingSl: boolean;
  newSlValue: string;
  setNewSlValue: (v: string) => void;
  onSlSave: (e: React.MouseEvent) => void;
  onSlCancel: () => void;
  handlePanicClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  handleSilentClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  handleFlashOpen: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
  setLoadingAction: (id: string | null) => void;
  fetchTrades: () => void;
  onDelegate: (e: React.MouseEvent) => void;
}
const ActionSegment: React.FC<ActionSegmentProps> = ({
  trade,
  isClosed,
  isTradeMode,
  loadingAction,
  payload,
  onEdit,
  onTpTrigger,
  onSlUpdate,
  isEditingSl,
  newSlValue,
  setNewSlValue,
  onSlSave,
  onSlCancel,
  handlePanicClose,
  handleSilentClose,
  handleFlashOpen,
  setLoadingAction,
  fetchTrades,
  onDelegate,
}) => (
  <div className="flex flex-col bg-slate-950/40 divide-y divide-white/5">
    <div className="px-2 py-1.5 flex items-center gap-1.5 border-b border-white/5 bg-slate-950/80">
      <Gamepad2 className="w-2.5 h-2.5 text-rose-400" />
      <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">
        EYLEM
      </span>
    </div>
    {!isClosed ? (
      <div className="grid grid-cols-2 gap-px bg-white/[0.03] flex-1">
        <A
          icon={<ExternalLink className="w-5 h-5" />}
          label="MEXC"
          href={`https://www.mexc.com/exchange/${trade.symbol.toUpperCase().replace("/", "").replace("USDT", "_USDT")}`}
          bg="bg-slate-900/40 hover:bg-slate-800"
        />
        <A
          icon={<TrendingUp className="w-5 h-5" />}
          label="DÜZENLE"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(trade);
          }}
          bg="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-4"
        />
        {trade.status === "PENDING" && payload.trailingBuy && (
          <A
            icon={
              loadingAction === "flash" ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <Zap className="w-5 h-5" />
              )
            }
            label="FLASH"
            onClick={(e) => handleFlashOpen(e, trade)}
            bg="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 animate-pulse"
          />
        )}
        <A
          icon={
            loadingAction === "sync" ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )
          }
          label="SENK"
          onClick={(e) => {
            e.stopPropagation();
            setLoadingAction("sync");
            fetchTrades();
            setTimeout(() => setLoadingAction(null), 500);
          }}
          bg="bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400"
        />
        <A
          icon={
            loadingAction === "tp" ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <Target className="w-5 h-5" />
            )
          }
          label="TP TETİKLE"
          onClick={onTpTrigger}
          bg="bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300"
        />
        {isEditingSl ? (
          <div className="flex flex-col items-center justify-center p-1 bg-rose-500/10 border border-rose-500/30">
            <span className="text-[7px] font-black text-rose-400 uppercase tracking-tighter mb-1">YENİ SL</span>
            <input 
              type="text" 
              value={newSlValue}
              onChange={(e) => setNewSlValue(e.target.value)}
              className="w-[80%] bg-black/60 border border-rose-500/20 rounded px-1.5 py-0.5 text-[10px] font-mono text-white text-center focus:border-rose-500/50 outline-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <button 
                onClick={onSlSave}
                className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={onSlCancel}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <ZapOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <A
            icon={
              loadingAction === "sl" ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <Shield className="w-5 h-5" />
              )
            }
            label="SL FIX"
            onClick={(e) => {
              e.stopPropagation();
              onSlUpdate();
            }}
            bg="bg-rose-500/5 hover:bg-rose-500/10 text-rose-300"
          />
        )}
        {(payload as any)?.source !== "pilot_auto" && (
           <A 
            icon={loadingAction === "delegate" ? <Loader2 className="animate-spin w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            label={loadingAction === "delegate" ? "DEVREDİLİYOR" : "PİLOT'A DEVRET"}
            onClick={onDelegate}
            bg="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 active:scale-95 transition-all shadow-[0_0_15px_-5px_rgba(34,211,238,0.4)]"
          />
        )}
        <div className="col-span-2 flex flex-col divide-y divide-white/5 mt-auto bg-slate-950/20">
          <button
            onClick={(e) => handlePanicClose(e, trade)}
            className="flex items-center justify-center gap-2 py-5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 transition-all border-t border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)] group/panic"
          >
            <ZapOff className="w-5 h-5 group-hover/panic:animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.2em] cyber-glow-text-rose">
              PANİK {isTradeMode ? "SAT" : "AL"} (EXIT)
            </span>
          </button>
          
          <button
            onClick={(e) => handleSilentClose(e, trade)}
            className="flex items-center justify-center gap-2 py-4 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-all group/archive"
          >
            <Archive className="w-4 h-4 group-hover/archive:bounce" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">
              SESSİZ ARŞİV
            </span>
          </button>
        </div>
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center p-4">
        <ShieldAlert className="w-6 h-6 opacity-20 text-slate-500" />
      </div>
    )}
  </div>
);

// ═══ ATOMIC HELPERS ═══

const T: React.FC<{
  label: string;
  value: string;
  color?: string;
  bg?: string;
  span?: number;
  pulse?: boolean;
}> = ({ label, value, color = "text-white", bg, span, pulse }) => (
  <div
    className={cn(
      "p-2 flex flex-col justify-center bg-slate-950/80 min-h-[46px]",
      bg,
      span === 2
        ? "col-span-2"
        : span === 3
          ? "col-span-3"
          : span === 4
            ? "col-span-4"
            : "",
    )}
  >
    <span className="text-[7px] font-black text-slate-650 uppercase tracking-widest leading-none mb-1.5 opacity-60 italic">
      {label}
    </span>
    <span
      className={cn(
        "text-[10px] font-black font-mono leading-tight truncate",
        color,
        pulse && "animate-pulse",
      )}
      title={value}
    >
      {value}
    </span>
  </div>
);

const A: React.FC<{
  icon: React.ReactNode;
  label: string;
  bg: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
}> = ({ icon, label, bg, onClick, href }) => {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[64px] py-1.5">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-[0.1em]">
        {label}
      </span>
    </div>
  );
  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("transition-all text-white", bg)}
      >
        {inner}
      </a>
    );
  return (
    <button onClick={onClick} className={cn("transition-all", bg)}>
      {inner}
    </button>
  );
};
