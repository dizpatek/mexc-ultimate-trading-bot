"use client";

import React, { useCallback, useMemo, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Target,
  ExternalLink,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useHoldings } from "../hooks/usePortfolio";
import { useTrade } from "@/context/TradeContext";
import { cn } from "@/lib/utils";
import { useWhaleRadar, WhaleAlert } from "../hooks/useWhaleRadar";
import { useNewsData, NewsItem } from "../hooks/useNewsData";
import { useNewsAnalytics } from "../hooks/useNewsAnalytics";

// --- Generic Ticker Component ---
const Ticker = <T,>({
  items,
  speed = "30s",
  gap = "gap-8",
  children,
}: {
  items: T[];
  speed?: string;
  gap?: string;
  children: (item: T, idx: number) => React.ReactNode;
}) => {
  if (items.length === 0) return null;
  const copies = items.length < 5 ? 3 : 2;
  const loopItems = Array.from({ length: copies }).flatMap((_, loopIdx) =>
    items.map((item, itemIdx) => ({
      ...item,
      _keyIdx: `${loopIdx}-${itemIdx}`,
    })),
  );

  return (
    <div className="flex-1 overflow-hidden relative">
      <div
        className={cn("flex items-center whitespace-nowrap", gap)}
        style={{ animation: `ticker ${speed} linear infinite` }}
      >
        {loopItems.map((item, idx) => children(item, idx))}
      </div>
    </div>
  );
};

// --- UI Components ---

const SentimentBar = ({
  score,
  confidence,
}: {
  score: number;
  confidence: number;
}) => {
  const normalizedWidth = Math.abs(score);
  const isPositive = score >= 0;

  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="text-[8px] font-black text-slate-600 w-5 text-right shrink-0">
        {score > 0 ? "+" : ""}
        {score}
      </span>
      <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 flex justify-end">
            {!isPositive && (
              <div
                className="h-full bg-gradient-to-l from-rose-500 to-rose-600 rounded-l-full shadow-[0_0_6px_rgba(244,63,94,0.6)] transition-all duration-500"
                style={{ width: `${normalizedWidth}%` }}
              />
            )}
          </div>
          <div className="w-[1px] bg-slate-600 shrink-0" />
          <div className="w-1/2">
            {isPositive && (
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-r-full shadow-[0_0_6px_rgba(16,185,129,0.6)] transition-all duration-500"
                style={{ width: `${normalizedWidth}%` }}
              />
            )}
          </div>
        </div>
      </div>
      <span className="text-[7px] font-mono text-slate-600 w-7 shrink-0">
        %{confidence}
      </span>
    </div>
  );
};

const NewsTicker = ({ items }: { items: NewsItem[] }) => {
  const trade = useTrade();
  const highImpact = useMemo(
    () =>
      items.filter(
        (i) =>
          i.isNew || i.impact === "HIGH" || Math.abs(i.sentimentScore) > 20,
      ),
    [items],
  );

  // P4.2: Show ticker if there are ANY items, but prioritize high impact
  const displayItems = highImpact.length > 0 ? highImpact : items.slice(0, 5);
  if (displayItems.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/40 border-b border-amber-500/20 py-1.5">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.05),transparent)] animate-pulse" />
      <div className="flex items-center gap-2 text-xs">
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border-r border-amber-500/30 font-black text-amber-500 uppercase z-10">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.2em]">FLAŞ</span>
        </div>

        <Ticker items={displayItems} speed="15s" gap="gap-8">
          {(item: NewsItem, idx) => (
            <span
              key={`${item.id}-${idx}`}
              className="inline-flex items-center gap-2 text-[11px]"
            >
              <span
                className={cn(
                  "font-black text-xs",
                  item.sentiment === "BULLISH"
                    ? "text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                    : item.sentiment === "BEARISH"
                      ? "text-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.4)]"
                      : "text-slate-400",
                )}
              >
                {item.sentiment === "BULLISH"
                  ? "▲"
                  : item.sentiment === "BEARISH"
                    ? "▼"
                    : "●"}
              </span>
              <span
                className={cn(
                  "font-black uppercase tracking-wider",
                  item.sentiment === "BULLISH"
                    ? "text-emerald-500/80"
                    : item.sentiment === "BEARISH"
                      ? "text-rose-500/80"
                      : "text-amber-200",
                )}
              >
                {item.relatedAsset}
              </span>
              <span
                className={cn(
                  "font-bold drop-shadow-sm transition-colors cursor-pointer hover:text-cyan-400",
                  item.sentiment === "BULLISH"
                    ? "text-emerald-400"
                    : item.sentiment === "BEARISH"
                      ? "text-rose-400"
                      : "text-slate-300",
                )}
                onClick={() => {
                  if (item.relatedAsset !== 'GLOBAL') {
                    trade.setSymbol(`${item.relatedAsset}/USDT`);
                    document.getElementById('mission-control-section')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {item.title}
              </span>
              <span className="text-slate-700 mx-3">│</span>
            </span>
          )}
        </Ticker>
      </div>
    </div>
  );
};

const NewsItemRow = ({
  item,
  isHeld,
  handleNewsTrade,
}: {
  item: NewsItem;
  isHeld: boolean;
  handleNewsTrade: (item: NewsItem, direction: "BUY" | "SELL") => void;
}) => {
  const trade = useTrade();
  const isCritical =
    item.impact === "HIGH" && Math.abs(item.sentimentScore) > 25;

  return (
    <div
      onClick={() => {
        if (item.relatedAsset !== 'GLOBAL') {
          trade.setSymbol(`${item.relatedAsset}/USDT`);
          document.getElementById('mission-control-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      }}
      className={cn(
        "p-2 border-b border-blue-900/30 hover:bg-blue-950/25 transition-all duration-300 group relative overflow-hidden cursor-pointer",
        isCritical && "bg-amber-950/10 border-amber-500/20",
        item.isNew && "animate-news-flash",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/8 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      {isCritical && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent animate-pulse pointer-events-none" />
      )}

      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[70%] rounded-r transition-all duration-300",
          item.sentiment === "BULLISH"
            ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
            : item.sentiment === "BEARISH"
              ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
              : "bg-slate-600 shadow-[0_0_5px_rgba(148,163,184,0.5)]",
        )}
      />

      <div className="flex items-center gap-2 pl-2">
        <span
          className={cn(
            "text-[9px] font-black px-1.2 py-0.5 rounded border uppercase tracking-tighter shrink-0",
            item.sentiment === "BULLISH"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : item.sentiment === "BEARISH"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-slate-800 border-slate-700 text-slate-400",
          )}
        >
          {item.relatedAsset}
        </span>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0"
        >
          <h4
            className="text-[13px] font-bold text-slate-200 leading-tight group-hover:text-blue-400 transition-colors truncate"
            title={item.originalTitle}
          >
            {item.title}
          </h4>
        </a>

        <span className="text-[11px] font-mono text-slate-600 font-bold shrink-0">
          {item.time}
        </span>
      </div>

      {/* Bottom Row: Meta + Wide Centered Slider + Controls */}
      <div className="flex items-center justify-between pl-2 mt-1 px-1 gap-3">
        {/* Meta Labels */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-[60px]">
          {isCritical && (
            <span className="text-[8px] font-black px-1 py-0.25 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse uppercase tracking-tight">
              KRT
            </span>
          )}
          {isHeld && <Target className="w-3 h-3 text-blue-400" />}
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[50px]">
            {item.source}
          </span>
        </div>

        {/* Centered & Wide Slider */}
        <div className="flex-1 flex justify-center max-w-[200px]">
          <SentimentBar
            score={item.sentimentScore}
            confidence={item.sentimentConfidence}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0 min-w-[75px] justify-end">
          {item.relatedAsset !== "GLOBAL" && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewsTrade(item, "BUY");
                }}
                className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black hover:bg-emerald-500/20 transition-colors"
              >
                AL
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewsTrade(item, "SELL");
                }}
                className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[8px] font-black hover:bg-rose-500/20 transition-colors"
              >
                SAT
              </button>
            </div>
          )}
          <ExternalLink className="w-2.5 h-2.5 text-slate-700 opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
};

// Oval pill bubble for whale radar history
const WhaleBubble = ({
  whale,
  isLatest,
  isDeemphasized,
}: {
  whale: WhaleAlert;
  isLatest: boolean;
  isDeemphasized: boolean;
}) => {
  const trade = useTrade();
  const isBuy = whale.side === "BUY";
  const valueK = (whale.valueUsd / 1000).toFixed(0);
  const timeStr = new Date(whale.time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={() => {
        const base = whale.symbol.split('/')[0];
        trade.setSymbol(`${base}/USDT`);
        document.getElementById('mission-control-section')?.scrollIntoView({ behavior: 'smooth' });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border shrink-0 whitespace-nowrap text-[9px] font-black transition-all cursor-pointer hover:border-cyan-500/60",
        isBuy
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : "bg-rose-500/15 border-rose-500/30 text-rose-400",
        isLatest &&
          "shadow-[0_0_12px_rgba(34,211,238,0.5)] border-cyan-500/40 animate-pulse",
        isDeemphasized && "opacity-40",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isBuy ? "bg-emerald-400" : "bg-rose-400",
        )}
      />
      <span className="font-black text-white/80">{whale.symbol}</span>
      <span className="font-mono">{whale.amount.toFixed(2)}</span>
      <span className="text-[8px] opacity-70">(${valueK}K)</span>
      <span
        className={cn(
          "uppercase tracking-wider text-[8px]",
          isBuy ? "text-emerald-300" : "text-rose-300",
        )}
      >
        {isBuy ? "▲ AL" : "▼ SAT"}
      </span>
      <span className="text-[7px] opacity-50 font-mono ml-1">{timeStr}</span>
    </div>
  );
};

// --- Main Component ---

export const IntelligenceHub = ({ 
  hideHeader = false,
  isExpanded: propIsExpanded,
  onToggleExpanded,
  // External data props
  data: propNews,
  isLoading: propLoading,
  error: propError,
  fetchNews: propFetchNews,
  aggregateSentiment: propSentiment,
  stats: propStats,
}: { 
  hideHeader?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  data?: NewsItem[];
  isLoading?: boolean;
  error?: string | null;
  fetchNews?: () => Promise<void>;
  aggregateSentiment?: number;
  stats?: { bullCount: number; bearCount: number };
}) => {
  const { data: holdings } = useHoldings();
  const trade = useTrade();
  const [internalIsExpanded, setInternalIsExpanded] = React.useState(false);
  const isSectionExpanded = propIsExpanded !== undefined ? propIsExpanded : internalIsExpanded;
  const setIsSectionExpanded = onToggleExpanded || setInternalIsExpanded;
  const whaleScrollRef = useRef<HTMLDivElement>(null);

  // De-coupled hooks
  const internalNews = useNewsData(propNews === undefined);
  const internalAnalytics = useNewsAnalytics(internalNews.rawNews);

  // Fallback logic
  const rawNews = propNews !== undefined ? propNews : internalNews.rawNews;
  const loading = propLoading !== undefined ? propLoading : internalNews.loading;
  const error = propError !== undefined ? propError : internalNews.error;
  const fetchNews = propFetchNews !== undefined ? propFetchNews : internalNews.fetchNews;
  
  const { intel, aggregateSentiment, stats } = useMemo(() => {
    if (propNews !== undefined) {
      return { 
        intel: propNews, 
        aggregateSentiment: propSentiment ?? 0, 
        stats: propStats ?? { bullCount: 0, bearCount: 0 } 
      };
    }
    return internalAnalytics;
  }, [propNews, propSentiment, propStats, internalAnalytics]);
  
  // Only watch whales for the top holding to save CPU/Bandwidth
  const topAsset = useMemo(() => {
    if (!holdings || holdings.length === 0) return undefined;
    const tradable = holdings.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC');
    if (tradable.length === 0) return undefined;
    return tradable.reduce((max, h) => (h.holding * h.price > max.holding * max.price ? h : max)).symbol;
  }, [holdings]);

  const {
    alert: latestWhaleAlert,
    alerts: whaleHistory,
    status,
  } = useWhaleRadar(topAsset ? [topAsset] : ["BTC/USDT", "ETH/USDT"]);

  const handleNewsTrade = useCallback(
    (item: NewsItem, direction: "BUY" | "SELL") => {
      const assetSymbol =
        item.relatedAsset === "GLOBAL"
          ? "BTC/USDT"
          : `${item.relatedAsset}/USDT`;

      const isHeld = holdings?.some((h) => {
        const hSym = h.symbol.replace("/", "").replace("USDT", "");
        return hSym === item.relatedAsset;
      });

      trade.setSymbol(assetSymbol);
      trade.setMode(direction === "BUY" ? "TRADE" : "COVER");

      if (direction === "SELL" && isHeld) {
        trade.setUseExisting(true);
      } else {
        trade.setUseExisting(false);
        trade.setAmount("0");
        trade.setAllocationPercent(0);
      }

      trade.setTpEnabled(true);
      trade.setSlEnabled(true);
      trade.setIsTradeFormOpen(true);
      trade.scrollToTrade("UNITS");
    },
    [trade, holdings],
  );

  // Auto scroll whale history to left when new alert comes in
  React.useEffect(() => {
    if (whaleScrollRef.current && latestWhaleAlert) {
      whaleScrollRef.current.scrollLeft = 0;
    }
  }, [latestWhaleAlert]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#020617] to-[#0f172a]/90 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)] relative group/hub">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-pulse" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-30" />

      {/* UNIFIED COMMAND BAR (Header) */}
      {!hideHeader && (
        <div 
          className="relative z-20 flex flex-wrap items-center justify-center sm:justify-between py-2 px-2 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-colors backdrop-blur-sm rounded-t-xl font-mono cursor-pointer"
          onClick={() => setIsSectionExpanded(!isSectionExpanded)}
        >
          {/* GROUP 1: SECTION TITLE */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/20 shadow-lg">
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden lg:block">
                INTELLIGENCE HUB
              </h2>
            </div>
          </div>

          {/* GROUP 2: SENTIMENT STATUS */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-slate-950/20",
                aggregateSentiment > 5
                  ? "text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : aggregateSentiment < -5
                    ? "text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                    : "text-slate-400",
              )}
            >
              {aggregateSentiment > 5 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : aggregateSentiment < -5 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              24S SKOR: {aggregateSentiment > 0 ? "+" : ""}
              {aggregateSentiment}
            </div>
          </div>

          {/* GROUP 3: ACTIONS */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-950/20 gap-1">
               <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  fetchNews(true);
                }}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white transition-all"
                title="Yenile"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-cyan-400")} />
              </button>
              
              <button
                 className={cn(
                   "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                   isSectionExpanded ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
                 )}
                 onClick={(e) => { e.stopPropagation(); setIsSectionExpanded(!isSectionExpanded); }}
              >
                {isSectionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span className="">{isSectionExpanded ? "GİZLE" : "GÖSTER"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "transition-all duration-500 overflow-hidden flex flex-col flex-1",
          isSectionExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {/* Whale Watch — History Feed Moved to Top */}
        <div className="p-2.5 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-blue-500/30 relative overflow-hidden group/whale z-10 shrink-0">
          <div className="absolute top-0 bottom-0 left-[-100%] w-1/2 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent group-hover/whale:animate-[sweep_2s_ease-in-out_infinite]" />
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 relative z-10">
            <span className="flex items-center gap-1.5 text-blue-400 drop-shadow-[0_0_3px_rgba(96,165,250,0.6)]">
              <Activity className="w-3.5 h-3.5" /> BALİNA RADARI
            </span>
            <span
              className={cn(
                "tracking-widest text-[9px]",
                status === "connected"
                  ? "text-emerald-400"
                  : status === "connecting"
                    ? "text-cyan-500 animate-pulse"
                    : "text-slate-600",
              )}
            >
              {status === "connected"
                ? "AKTİF"
                : status === "connecting"
                  ? "TARANIYOR..."
                  : status === "error"
                    ? "BAĞLANTI HATASI"
                    : "BEKLEMEDE"}
            </span>
          </div>

          {/* Scrollable oval bubble history */}
          {whaleHistory.length > 0 ? (
            <div
              ref={whaleScrollRef}
              className="flex gap-2 overflow-x-auto pb-1 relative z-10 scrollbar-hide"
              style={{ scrollbarWidth: "none" }}
            >
              {whaleHistory.map((w, idx) => (
                <WhaleBubble
                  key={w.id}
                  whale={w}
                  isLatest={idx === 0}
                  isDeemphasized={idx >= 3}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] relative z-10 bg-[#020617]/70 rounded-lg p-1.5 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-pulse" />
              <span className="font-black text-slate-500">AĞ</span>
              <span className="text-slate-600 font-mono text-[9px]">
                Sıradışı işlem bekleniyor...
              </span>
            </div>
          )}
        </div>

        <NewsTicker items={intel} />

        {/* Sentiment Overview Bar */}
        {intel.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border-b border-blue-900/20 relative z-10">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest shrink-0">
              PİYASA
            </span>
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                style={{ width: `${(stats.bullCount / intel.length) * 100}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-700"
                style={{ width: `${(stats.bearCount / intel.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-black text-[8px]">
              <span className="text-emerald-500">{stats.bullCount}▲</span>
              <span className="text-slate-700">/</span>
              <span className="text-rose-500">{stats.bearCount}▼</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-0 cyber-scrollbar">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-2">
              <Activity className="w-6 h-6 text-slate-700" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {error}
              </span>
              <button
                onClick={() => fetchNews(true)}
                className="text-xs font-black text-blue-400 border-b border-blue-400/30 pb-0.5 hover:text-blue-300 transition-colors"
              >
                YENİDEN DENE
              </button>
            </div>
          ) : intel.length === 0 && loading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5 animate-pulse">
                  <div className="h-2.5 w-1/4 bg-slate-800 rounded" />
                  <div className="h-8 w-full bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : (
            Array.from(new Map(intel.map(it => [it.id, it])).values()).map((item, idx) => (
              <NewsItemRow
                key={`${item.id}-${idx}`}
                item={item}
                isHeld={!!holdings?.find((h) => h.symbol === item.relatedAsset)}
                handleNewsTrade={handleNewsTrade}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
