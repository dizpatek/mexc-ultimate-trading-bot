import React, { useMemo } from "react";
import { SmartTradeOrder } from "../ActiveSmartTrades";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// TradeProgressBar — v3.0 (Complete Rewrite)
// Supports 3 modes: TBUY Tracking | Active Trade | Minimal
// ═══════════════════════════════════════════════════════════

interface TradeProgressBarProps {
  trade: SmartTradeOrder;
  entry: number;
  currentPrice: number;
  sl: number;
  tp: number;
  pnlPercent: number;
  pnlUsdt: number;
  isProfit: boolean;
  trailingTpDev?: number;
  trailingSlDev?: number;
  isTtpActive?: boolean;
  isTslActive?: boolean;
  trailingBuyDev?: number;
}

// ── Helpers ──────────────────────────────────────────────
const fmt = (val: any) => {
  const p = Number(val);
  if (isNaN(p) || !isFinite(p)) return "--";
  if (p === 0) return "0";
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 10) return p.toFixed(3);
  return p.toFixed(2);
};

const pct = (val: any) => {
  const v = Number(val);
  if (isNaN(v)) return "--%";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};

/** Safe normalized position within a price range (0..100) */
const normalizePos = (price: number, lo: number, hi: number): number => {
  const range = hi - lo;
  if (range <= 0 || !isFinite(range)) return 50;
  return Math.min(100, Math.max(0, ((price - lo) / range) * 100));
};

/** Compute padded range from an array of prices */
const computeRange = (
  prices: number[],
  paddingFactor = 0.08,
): { lo: number; hi: number } => {
  const valid = prices.filter((p) => p > 0 && isFinite(p));
  if (valid.length === 0) return { lo: 0, hi: 1 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const pad = (max - min) * paddingFactor || min * 0.005;
  return { lo: min - pad, hi: max + pad };
};

// ── Reusable marker sub-components ──────────────────────
interface MarkerProps {
  pos: number;
  color: string;
  height?: string;
  glow?: string;
  opacity?: string;
}
const VLine: React.FC<MarkerProps> = ({
  pos,
  color,
  height = "h-2.5",
  glow,
  opacity,
}) => (
  <div
    style={{ left: `${pos}%`, ...(glow ? { boxShadow: glow } : {}) }}
    className={cn(
      "absolute top-1/2 -translate-y-1/2 w-0.5 z-10",
      height,
      color,
      opacity,
    )}
  />
);

interface PriceThumbProps {
  pos: number;
  price: number;
  color: string;
  glowColor: string;
  label?: string;
  tooltip?: string;
  animate?: boolean;
}
const PriceThumb: React.FC<PriceThumbProps> = ({
  pos,
  price,
  color,
  glowColor,
  label,
  tooltip,
  animate,
}) => (
  <div
    style={{ left: `${pos}%` }}
    className={cn(
      "absolute top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center transition-all duration-700 cursor-help group/thumb"
    )}
  >
    {/* Colored Dot (Point) */}
    <div
      style={{
        ...(glowColor ? { boxShadow: `0 0 8px 1px ${glowColor}` } : {}),
      }}
      className={cn(
        "w-2.5 h-2.5 rounded-full bg-current relative z-20",
        color,
        animate && "animate-pulse"
      )}
    />
    
    {/* Price above */}
    <div
      className={cn(
        "absolute bottom-[calc(100%+6px)] text-[9px] font-black whitespace-nowrap z-50",
        color,
      )}
    >
      ${fmt(price)}
    </div>
    
    {/* Sub-label */}
    {label && (
      <div
        className={cn(
          "absolute top-[calc(100%+6px)] text-[8px] font-bold whitespace-nowrap z-50",
          color,
          "opacity-80",
        )}
      >
        {label}
      </div>
    )}
    
    {/* Hover tooltip */}
    {tooltip && (
      <div
        className={cn(
          "absolute bottom-[calc(100%+22px)] px-1.5 py-1 rounded text-[9px] font-black whitespace-nowrap",
          "transition-all opacity-0 group-hover/thumb:opacity-100 scale-90 group-hover/thumb:scale-100 shadow-xl z-50",
          color,
          "text-white bg-slate-900 border border-white/10",
        )}
      >
        {tooltip}
      </div>
    )}
  </div>
);

const FillLine: React.FC<{ from: number; to: number; color: string }> = ({
  from,
  to,
  color,
}) => {
  const left = Math.min(from, to);
  const width = Math.abs(to - from);
  return (
    <div
      style={{ left: `${left}%`, width: `${width}%` }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-0.5 z-0 opacity-60",
        color,
      )}
    />
  );
};

const EntryLabel: React.FC<{ pos: number; price: number }> = ({
  pos,
  price,
}) => (
  <div
    style={{ left: `${Math.min(88, Math.max(12, pos))}%` }}
    className="absolute top-[calc(100%+3px)] -translate-x-1/2 text-[8px] font-black text-amber-500/80 whitespace-nowrap z-30"
  >
    E:${fmt(price)}
  </div>
);

const TargetMarker: React.FC<{ pos: number; price: number; type: "TP" | "SL" }> = ({
  pos,
  price,
  type,
}) => {
  const isTp = type === "TP";
  return (
    <div
      style={{ left: `${Math.min(92, Math.max(8, pos))}%` }}
      className={cn(
        "absolute -top-[20px] -translate-x-1/2 px-1 py-[2px] rounded text-[9px] font-black whitespace-nowrap z-40 border shadow-sm",
        isTp
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
          : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]"
      )}
    >
      {type} {fmt(price)}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const TradeProgressBar: React.FC<TradeProgressBarProps> = (props) => {
  const {
    trade,
    entry,
    currentPrice,
    sl,
    tp,
    pnlPercent,
    pnlUsdt,
    isProfit,
    trailingTpDev,
    trailingSlDev,
    isTtpActive,
    isTslActive,
    trailingBuyDev,
  } = props;

  const meta = trade.meta;
  const isPending = trade.status === "PENDING";
  const hasTbuy = !!meta.payload?.trailingBuy;

  // ─── MODE 1: TRAILING BUY TRACKING ───────────────────
  if (isPending && hasTbuy) {
    return (
      <TbuyBar
        trade={trade}
        entry={entry}
        currentPrice={currentPrice}
        sl={sl}
        tp={tp}
        dev={trailingBuyDev || meta.payload?.trailingBuyDev || 1}
      />
    );
  }

  // ─── MODE 2: ACTIVE/CLOSED TRADE (SL+TP visible) ─────
  if (sl > 0 || tp > 0) {
    return (
      <ActiveTradeBar
        trade={trade}
        entry={entry}
        currentPrice={currentPrice}
        sl={sl}
        tp={tp}
        pnlPercent={pnlPercent}
        pnlUsdt={pnlUsdt}
        isProfit={isProfit}
        trailingTpDev={trailingTpDev}
        trailingSlDev={trailingSlDev}
        isTtpActive={isTtpActive}
        isTslActive={isTslActive}
      />
    );
  }

  // ─── MODE 3: MINIMAL (no SL/TP set) ──────────────────
  return (
    <MinimalBar
      entry={entry}
      currentPrice={currentPrice}
      pnlPercent={pnlPercent}
      isProfit={isProfit}
    />
  );
};

// ═══════════════════════════════════════════════════════════
// MODE 1: TBUY TRACKING BAR
// ═══════════════════════════════════════════════════════════
const TbuyBar: React.FC<{
  trade: SmartTradeOrder;
  entry: number;
  currentPrice: number;
  sl: number;
  tp: number;
  dev: number;
}> = ({ trade, entry, currentPrice, sl, tp, dev }) => {
  const data = useMemo(() => {
    const isCover = trade.meta.mode === "COVER";
    // For Trade (BUY): follows price DOWN. Trigger = lowest * (1 + dev)
    // For Cover (SELL): follows price UP. Trigger = highest * (1 - dev)
    const historicalBest = isCover 
      ? (trade.meta.highestPrice || currentPrice)
      : (trade.meta.lowestPrice || currentPrice);
      
    const lowestSeen = isCover ? Math.max(entry, historicalBest) : Math.min(entry, historicalBest);
    const triggerPrice = isCover 
      ? lowestSeen * (1 - dev / 100)
      : lowestSeen * (1 + dev / 100);

    const distFromTrigger =
      ((currentPrice - triggerPrice) / triggerPrice) * 100;
    const distFromEntry = ((currentPrice - entry) / entry) * 100;
    
    const prices = [entry, triggerPrice, currentPrice];
    if (sl > 0) prices.push(sl);
    if (tp > 0) prices.push(tp);
    const { lo, hi } = computeRange(prices, 0.15);

    return {
      triggerPrice,
      distFromTrigger,
      distFromEntry,
      lowestSeen,
      entryPos: normalizePos(entry, lo, hi),
      triggerPos: normalizePos(triggerPrice, lo, hi),
      currentPos: normalizePos(currentPrice, lo, hi),
      lowestPos: normalizePos(lowestSeen, lo, hi),
      slPos: sl > 0 ? normalizePos(sl, lo, hi) : 0,
      tpPos: tp > 0 ? normalizePos(tp, lo, hi) : 0,
    };
  }, [entry, currentPrice, dev, sl, tp, trade.meta.lowestPrice, trade.meta.highestPrice, trade.meta.mode]);

  return (
    <div className="px-1.5 py-1 flex items-center gap-2 w-full">
      {/* Left label */}
      <div className="flex flex-col shrink-0 min-w-[30px] text-[8px] font-black leading-tight text-cyan-400 uppercase">
        <span>TBUY</span>
        <span className="text-cyan-400/50">{dev}%</span>
      </div>

      {/* Bar */}
      <div className="flex-1 pt-5 pb-3">
        <div className="h-1.5 w-full bg-slate-800/50 rounded-full relative border border-cyan-500/20">
          {/* Entry marker */}
          <VLine pos={data.entryPos} color="bg-amber-400/70" />
          <EntryLabel pos={data.entryPos} price={entry} />

          {/* Planned Targets */}
          {sl > 0 && (
            <>
              <VLine pos={data.slPos} color="bg-rose-500/30" height="h-2" />
              <TargetMarker pos={data.slPos} price={sl} type="SL" />
            </>
          )}
          {tp > 0 && (
            <>
              <VLine pos={data.tpPos} color="bg-emerald-500/30" height="h-2" />
              <TargetMarker pos={data.tpPos} price={tp} type="TP" />
            </>
          )}

          {/* Trigger line */}
          <VLine
            pos={data.triggerPos}
            color="bg-cyan-400/80"
            height="h-3"
            glow="0 0 4px rgba(34,211,238,0.6)"
          />

          {/* Trigger label */}
          <div className="absolute -top-[16px] right-0 text-[8px] font-black text-amber-500 uppercase tracking-tighter">
            TETİK: {fmt(data.triggerPrice)}
            <span
              className={cn(
                "ml-1 font-bold",
                data.distFromTrigger > 0 ? "text-rose-400" : "text-emerald-400",
              )}
            >
              ({pct(data.distFromTrigger)})
            </span>
          </div>

          {/* Fill line */}
          <FillLine
            from={data.entryPos}
            to={data.currentPos}
            color="bg-cyan-400"
          />

          {/* Current price */}
          <PriceThumb
            pos={data.currentPos}
            price={currentPrice}
            color="text-cyan-300"
            glowColor="rgba(34,211,238,0.6)"
            label={pct(data.distFromEntry)}
            animate
          />
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MODE 2: ACTIVE TRADE BAR (SL / TP / Trailing)
// ═══════════════════════════════════════════════════════════
interface ActiveBarProps {
  trade: SmartTradeOrder;
  entry: number;
  currentPrice: number;
  sl: number;
  tp: number;
  pnlPercent: number;
  pnlUsdt: number;
  isProfit: boolean;
  trailingTpDev?: number;
  trailingSlDev?: number;
  isTtpActive?: boolean;
  isTslActive?: boolean;
}

const ActiveTradeBar: React.FC<ActiveBarProps> = ({
  trade,
  entry,
  currentPrice,
  sl,
  tp,
  pnlPercent,
  pnlUsdt,
  isProfit,
  trailingTpDev,
  trailingSlDev,
  isTtpActive,
  isTslActive,
}) => {
  const side = trade.side;
  const meta = trade.meta;

  const data = useMemo(() => {
    const highestPrice = Math.max(
      Number(meta.highestPrice) || entry,
      currentPrice,
    );
    const lowestPrice = Math.min(
      Number(meta.lowestPrice) || entry,
      currentPrice,
    );

    // ── Dynamic SL (Trailing Stop Loss) ──
    let dynSl = sl;
    if (isTslActive && trailingSlDev !== undefined && trailingSlDev > 0) {
      // Prioritize setting deviation, fallback to initial SL distance
      const distPercent = trailingSlDev > 0 ? trailingSlDev : (Math.abs(entry - sl) / entry) * 100;
      
      if (side === "BUY") {
        dynSl = Math.max(sl, highestPrice * (1 - distPercent / 100));
      } else {
        dynSl = Math.min(sl, lowestPrice * (1 + distPercent / 100));
      }
    }

    // ── Dynamic TP (Trailing Take Profit) ──
    let dynTp = tp;
    let tpPassedPct = 0;
    if (isTtpActive && trailingTpDev !== undefined && trailingTpDev > 0) {
      if (side === "BUY") {
        dynTp = Math.max(tp, highestPrice * (1 - trailingTpDev / 100));
        tpPassedPct =
          currentPrice > tp ? ((currentPrice - tp) / entry) * 100 : 0;
      } else {
        dynTp = Math.min(tp, lowestPrice * (1 + trailingTpDev / 100));
        tpPassedPct =
          currentPrice < tp ? ((tp - currentPrice) / entry) * 100 : 0;
      }
    }

    // ── Percentages relative to entry ──
    const dir = side === "BUY" ? 1 : -1;
    const dynSlPct = entry > 0 ? ((dynSl - entry) / entry) * 100 * dir : 0;
    const dynTpPct = entry > 0 ? ((dynTp - entry) / entry) * 100 * dir : 0;

    // ── Position normalization ──
    const prices = [entry, currentPrice];
    if (sl > 0) prices.push(sl, dynSl);
    if (tp > 0) prices.push(tp, dynTp);
    const { lo, hi } = computeRange(prices, 0.06);
    const pos = (p: number) => normalizePos(p, lo, hi);

    return {
      dynSl,
      dynTp,
      dynSlPct,
      dynTpPct,
      tpPassedPct,
      entryPos: pos(entry),
      currentPos: pos(currentPrice),
      slPos: pos(sl),
      dynSlPos: pos(dynSl),
      tpPos: pos(tp),
      dynTpPos: pos(dynTp),
    };
  }, [
    entry,
    currentPrice,
    sl,
    tp,
    side,
    meta.highestPrice,
    meta.lowestPrice,
    isTtpActive,
    isTslActive,
    trailingTpDev,
    trailingSlDev,
  ]);

  const tooltipText = `$${Number(currentPrice).toLocaleString()} | ${isProfit ? "+" : ""}${Number(pnlUsdt).toLocaleString(undefined, { style: "currency", currency: "USD" })} (${Number(pnlPercent).toFixed(2)}%)`;

  return (
    <div className="px-1.5 py-1 flex flex-col gap-0.5 w-full">
      {/* Header: matches the price axis (Low price on Left, High on Right) */}
      <div className={cn("flex justify-between items-center text-[9px] font-black uppercase tracking-tighter leading-none", side === "SELL" ? "flex-row-reverse" : "")}>
        <span className="text-rose-500 flex items-center gap-1">
          SL:{sl > 0 ? fmt(data.dynSl) : "--"}
          {sl > 0 && (
            <span className="text-rose-500/60 font-bold">
              ({pct(data.dynSlPct)})
            </span>
          )}
          {isTslActive && (
            <span className="text-rose-400 bg-rose-500/15 px-1 rounded text-[8px] animate-pulse">
              TSL
            </span>
          )}
        </span>
        <span className="text-emerald-500 flex items-center gap-1">
          {isTtpActive && (
            <span className="text-emerald-400 bg-emerald-500/15 px-1 rounded text-[8px] animate-pulse">
              TTP +{Number(data.tpPassedPct).toFixed(1)}%
            </span>
          )}
          {tp > 0 && (
            <span className="text-emerald-500/60 font-bold">
              ({pct(data.dynTpPct)})
            </span>
          )}
          TP:{tp > 0 ? fmt(data.dynTp) : "--"}
        </span>
      </div>

      {/* Progress bar track */}
      <div className="h-1.5 w-full bg-slate-800/50 rounded-full relative border border-white/5 mt-6 mb-4">
        {/* SL markers */}
        {sl > 0 && (
          <>
            <VLine pos={data.slPos} color="bg-rose-500/30" height="h-2" />
            <VLine
              pos={data.dynSlPos}
              color="bg-rose-500/80"
              height="h-2.5"
              glow="0 0 4px rgba(244,63,94,0.5)"
            />
            <TargetMarker pos={data.dynSlPos} price={data.dynSl} type="SL" />
          </>
        )}

        {/* TP markers */}
        {tp > 0 && (
          <>
            <VLine
              pos={data.tpPos}
              color={isTtpActive ? "bg-emerald-500/30" : "bg-emerald-500/60"}
              height={isTtpActive ? "h-2" : "h-2.5"}
            />
            {isTtpActive && (
              <VLine
                pos={data.dynTpPos}
                color="bg-emerald-400"
                height="h-2.5"
                glow="0 0 4px rgba(52,211,153,0.8)"
              />
            )}
            <TargetMarker pos={isTtpActive ? data.dynTpPos : data.tpPos} price={isTtpActive ? data.dynTp : tp} type="TP" />
          </>
        )}

        {/* Entry marker + label */}
        <VLine pos={data.entryPos} color="bg-amber-400/50" />
        <EntryLabel pos={data.entryPos} price={entry} />

        {/* PNL fill */}
        <FillLine
          from={data.entryPos}
          to={data.currentPos}
          color={isProfit ? "bg-emerald-500" : "bg-rose-500"}
        />

        {/* Current price thumb */}
        <PriceThumb
          pos={data.currentPos}
          price={currentPrice}
          color={isProfit ? "text-emerald-400" : "text-rose-400"}
          glowColor={isProfit ? "rgba(16,185,129,0.5)" : "rgba(244,63,94,0.5)"}
          tooltip={tooltipText}
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MODE 3: MINIMAL BAR (no SL/TP)
// ═══════════════════════════════════════════════════════════
const MinimalBar: React.FC<{
  entry: number;
  currentPrice: number;
  pnlPercent: number;
  isProfit: boolean;
}> = ({ currentPrice, pnlPercent, isProfit }) => {
  const entryPos = 50;
  const currentPos = Math.min(95, Math.max(5, 50 + pnlPercent * 2));

  return (
    <div className="px-1.5 py-1 flex flex-col gap-0.5 w-full">
      <div className="h-1.5 w-full bg-slate-800/50 rounded-full relative border border-white/5 mt-5 mb-4">
        <VLine pos={entryPos} color="bg-white/40" />
        <FillLine
          from={entryPos}
          to={currentPos}
          color={isProfit ? "bg-emerald-500" : "bg-rose-500"}
        />
        <PriceThumb
          pos={currentPos}
          price={currentPrice}
          color={isProfit ? "text-emerald-400" : "text-rose-400"}
          glowColor={isProfit ? "rgba(16,185,129,0.5)" : "rgba(244,63,94,0.5)"}
        />
      </div>
    </div>
  );
};
