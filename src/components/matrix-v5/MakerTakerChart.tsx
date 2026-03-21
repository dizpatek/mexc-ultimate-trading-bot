"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useTimeframe, Timeframe } from "@/context/TimeframeContext";

// --- TYPES & INTERFACES ---

export interface ExchangeFlow {
  id: string;
  label: string;
  color: string;
  buyVol: number;   // $ toplam buy hacmi
  sellVol: number;  // $ toplam sell hacmi
  net: number;      // buy - sell
  netPct: number;   // net / (buy+sell) * 100
  tradeCount: number;
  topTradeSize: number; // en büyük tek işlem $
  trades: { t: number; p: number; q: number; side: boolean; usd: number }[];
  error?: boolean;
}

const ALL_EXCHANGES = [
  { id: 'BINANCE_PERP',   label: 'Binance P',   color: '#f0b90b', group: 'top' },
  { id: 'BINANCE_SPOT',   label: 'Binance S',   color: '#f0b90b', group: 'top' },
  { id: 'BYBIT_PERP',     label: 'Bybit P',     color: '#ff6b35', group: 'top' },
  { id: 'BYBIT_SPOT',     label: 'Bybit S',     color: '#ff6b35', group: 'top' },
  { id: 'OKX_PERP',       label: 'OKX P',       color: '#0062ff', group: 'top' },
  { id: 'OKX_SPOT',       label: 'OKX S',       color: '#0062ff', group: 'top' },
  { id: 'COINBASE_SPOT',  label: 'Coinbase',    color: '#0052ff', group: 'top' },
  { id: 'KRAKEN_SPOT',    label: 'Kraken',      color: '#5741d9', group: 'top' },
  { id: 'KUCOIN_PERP',    label: 'KuCoin P',    color: '#23af91', group: 'mid' },
  { id: 'KUCOIN_SPOT',    label: 'KuCoin S',    color: '#23af91', group: 'mid' },
  { id: 'GATE_PERP',      label: 'Gate P',      color: '#07c160', group: 'mid' },
  { id: 'GATE_SPOT',      label: 'Gate S',      color: '#07c160', group: 'mid' },
  { id: 'BITGET_PERP',    label: 'Bitget P',    color: '#00c8ff', group: 'mid' },
  { id: 'BITGET_SPOT',    label: 'Bitget S',    color: '#00c8ff', group: 'mid' },
  { id: 'MEXC_PERP',      label: 'MEXC P',      color: '#1be0c0', group: 'mid' },
  { id: 'MEXC_SPOT',      label: 'MEXC S',      color: '#1be0c0', group: 'mid' },
  { id: 'HUOBI_PERP',     label: 'Huobi P',     color: '#ff4546', group: 'mid' },
  { id: 'HUOBI_SPOT',     label: 'Huobi S',     color: '#ff4546', group: 'mid' },
  { id: 'HYPER_PERP',     label: 'Hyper P',     color: '#6e44ff', group: 'alt' },
  { id: 'HYPER_SPOT',     label: 'Hyper S',     color: '#6e44ff', group: 'alt' },
  { id: 'WOO_PERP',       label: 'WOO P',       color: '#00bcf0', group: 'alt' },
  { id: 'WOO_SPOT',       label: 'WOO S',       color: '#00bcf0', group: 'alt' },
  { id: 'ASTER_PERP',     label: 'Aster P',     color: '#a78bfa', group: 'alt' },
  { id: 'ASTER_SPOT',     label: 'Aster S',     color: '#a78bfa', group: 'alt' },
  { id: 'UPBIT_SPOT',     label: 'Upbit',       color: '#0078ff', group: 'alt' },
  { id: 'POLONIEX_SPOT',  label: 'Poloniex',    color: '#45b36b', group: 'alt' },
];

/**
 * P4.3: Bulk Trade Fetcher with Database Caching (Server-Side)
 */
async function fetchExchangeFlows(symbol: string, minutes = 5, exchangeIds?: string[]): Promise<ExchangeFlow[]> {
  const toMs = Date.now();
  const fromMs = toMs - minutes * 60 * 1000;
  const ids = exchangeIds ?? ALL_EXCHANGES.map(e => e.id);
  
  const url = `/api/market/trades?symbol=${symbol}&exchange=${ids.join(',')}&from=${fromMs}&to=${toMs}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  try {
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(30000),
      headers: token ? { 'Authorization': `Bearer ${token}` } : {} as any
    });
    if (!response.ok) return [];
    
    const bulkData = (await response.json()) as Record<string, any[]>;
    if (!bulkData || typeof bulkData !== 'object') return [];

    return ids.map(id => {
      const rawTrades = bulkData[id] || [];
      const meta = ALL_EXCHANGES.find(e => e.id === id)!;
      let buyVol = 0, sellVol = 0, topTradeSize = 0;
      
      const trades = rawTrades.map((t: any) => {
        const usd = Number(t.usd);
        if (t.side === 1) buyVol += usd; else sellVol += usd;
        if (usd > topTradeSize) topTradeSize = usd;
        return {
          t: Number(t.t),
          p: Number(t.p),
          q: Number(t.q),
          side: t.side === 1,
          usd
        };
      });

      const net = buyVol - sellVol;
      const total = buyVol + sellVol;

      return {
        id, label: meta.label, color: meta.color,
        buyVol, sellVol, net, netPct: total > 0 ? (net / total) * 100 : 0,
        tradeCount: trades.length, topTradeSize, trades,
      } as ExchangeFlow;
    }).filter(f => f.tradeCount > 0 || f.buyVol > 0);

  } catch (error) {
    console.warn("[MakerTakerChart] Bulk exchange fetch failed:", error);
    return [];
  }
}

function tfToMins(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 1;
    case '15m': return 15;
    case '1h': return 60;
    case '4h': return 240;
    case '1d': return 1440;
    case '1w': return 10080;
    case '1Mo': return 43200;
    default: return 5;
  }
}

export function MultiExchangeFlowChart({ symbol = 'BTC-USDT' }: { symbol?: string }) {
  const { timeframe } = useTimeframe();
  const mins = tfToMins(timeframe);
  const [flows, setFlows] = useState<ExchangeFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hoverTrade, setHoverTrade] = useState<{ x: number; y: number; trade: any; ex: string; candle?: any } | null>(null);
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sym, setSym] = useState(symbol);
  const [filterGroup, setFilterGroup] = useState<'all'|'top'|'mid'|'alt'>('all');
  const [candles, setCandles] = useState<any[]>([]);

  // ── Zoom / Pan state ──
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewRange, setViewRange] = useState<{ minT: number; maxT: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; minT: number; maxT: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const ids = filterGroup === 'all' ? undefined : ALL_EXCHANGES.filter(e => e.group === filterGroup).map(e => e.id);
    
    const klineInterval = mins <= 15 ? '1m' : mins <= 120 ? '5m' : '1h';
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 15000);

    try {
      const [flowData, klineData] = await Promise.all([
        fetchExchangeFlows(sym, mins, ids),
        api.get("/market/klines", { 
          params: { symbol: sym.replace('-USDT','USDT'), interval: klineInterval, limit: 300 },
          signal: abortCtrl.signal 
        }).then((r: any) => r.data).catch(() => [])
      ]);

      setFlows(flowData);
      setCandles(klineData);
      setLastUpdate(new Date());
    } catch (err) {
      console.warn("[MakerTakerChart] Load failed:", err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setViewRange(null);
    }
  }, [sym, mins, filterGroup]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  // ── Helper formatters ──
  const fmtUsd = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return '$0';
    return v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}k` : `${v.toFixed(0)}`;
  };
  const fmtTime = (ms: number) => {
    if (!ms || isNaN(ms)) return '--:--';
    return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const fmtPrice = (p: number) => {
    if (!p || isNaN(p)) return '0';
    if (p >= 10000) return p.toFixed(0);
    if (p >= 100) return p.toFixed(1);
    if (p >= 1) return p.toFixed(2);
    return p.toFixed(4);
  };

  const sortedFlows = [...flows].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const maxVol = Math.max(...flows.map(f => Math.max(f.buyVol, f.sellVol)), 1);
  const totalBuy = flows.reduce((s, f) => s + f.buyVol, 0);
  const totalSell = flows.reduce((s, f) => s + f.sellVol, 0);
  const totalNet = totalBuy - totalSell;
  const dominantDir = totalNet > 0 ? 'BUY' : 'SELL';

  const scatterFlows = selectedEx ? flows.filter(f => f.id === selectedEx) : flows;
  const allTrades: { t: number; p: number; usd: number; side: boolean; exColor: string; exLabel: string }[] = [];
  for (const f of scatterFlows) {
    for (const tr of f.trades) {
      allTrades.push({ t: tr.t, p: tr.p, usd: tr.usd, side: tr.side, exColor: f.color, exLabel: f.label });
    }
  }
  allTrades.sort((a, b) => a.t - b.t);

  const tradeMinT = allTrades.length ? allTrades[0].t : Date.now() - mins * 60000;
  const candleMinT = candles.length ? Number(candles[0].time) : tradeMinT;
  const dataMinT = Math.min(tradeMinT, candleMinT);
  const tradeMaxT = allTrades.length ? allTrades[allTrades.length - 1].t : Date.now();
  const candleMaxT = candles.length ? Number(candles[candles.length - 1].time) : tradeMaxT;
  const dataMaxT = Math.max(tradeMaxT, candleMaxT);

  const minT = viewRange?.minT ?? (allTrades.length ? allTrades[0].t : dataMinT);
  const maxT = viewRange?.maxT ?? dataMaxT;
  const tSpan = Math.max(maxT - minT, 1000);
  const fullSpan = Math.max(dataMaxT - dataMinT, 1);
  const zoomLevel = fullSpan / tSpan;

  let minP = 0, maxP = 1, maxUsd = 1;
  const visibleCandles = candles.filter(c => Number(c.time) >= minT - 60000 && Number(c.time) <= maxT + 60000);

  if (allTrades.length || visibleCandles.length) {
    const firstP = allTrades.length ? allTrades[0].p : (visibleCandles.length ? visibleCandles[0].close : 0);
    minP = firstP; maxP = firstP;
    maxUsd = allTrades.length ? allTrades[0].usd : 1;
    for (const tr of allTrades) {
      if (isNaN(tr.p) || isNaN(tr.usd)) continue;
      if (tr.p < minP) minP = tr.p;
      if (tr.p > maxP) maxP = tr.p;
      if (tr.usd > maxUsd) maxUsd = tr.usd;
    }
    for (const c of visibleCandles) {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    }
    if (minP === maxP) { minP *= 0.999; maxP *= 1.001; }
    else { minP *= 0.9995; maxP *= 1.0005; }
  }
  const maxTotalVol = candles.reduce((m, c) => Math.max(m, c.volume || 0), 1);
  const curPrice = candles.length ? candles[candles.length - 1].close : (allTrades.length ? allTrades[allTrades.length - 1].p : 0);
  const WHALE = 100_000;

  const aggregated: typeof allTrades = [];
  const aggWindow = allTrades.length > 5000 ? 5000 : 2500; 
  for (const tr of allTrades) {
    const last = aggregated[aggregated.length - 1];
    if (last && Math.abs(last.t - tr.t) < aggWindow && last.side === tr.side) {
      const totalQ = (last.usd / (last.p || 1)) + (tr.usd / (tr.p || 1));
      last.p = totalQ > 0 ? (last.usd + tr.usd) / totalQ : last.p;
      last.usd += tr.usd;
      last.t = Math.max(last.t, tr.t);
    } else { aggregated.push({ ...tr }); }
  }

  const sortedByUsd = [...aggregated].sort((a, b) => b.usd - a.usd);
  const labelThreshold = sortedByUsd.length > 30 ? sortedByUsd[29]?.usd ?? 50000 : (sortedByUsd[0]?.usd ?? 50000) * 0.3;

  const svgW = 900, svgH = 400;
  const pad = { l: 60, r: 65, t: 14, b: 30 };
  const chartW = svgW - pad.l - pad.r;
  const chartH = svgH - pad.t - pad.b;
  const tx = (t: number) => pad.l + ((t - minT) / tSpan) * chartW;
  const ty = (p: number) => pad.t + chartH - ((p - minP) / Math.max(maxP - minP, 1)) * chartH;
  const tSize = (usd: number) => Math.max(2, Math.min(28, Math.sqrt((usd / Math.max(maxUsd, 1)) * 1600) / Math.PI));

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (allTrades.length === 0) return;
      const rect = el.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * svgW;
      const chartFrac = Math.max(0, Math.min(1, (svgX - pad.l) / chartW));
      const pivotT = minT + chartFrac * tSpan;
      const factor = e.deltaY > 0 ? 1.25 : 0.8;
      const newSpan = Math.min(Math.max(tSpan * factor, 5000), fullSpan * 2);
      let newMin = pivotT - chartFrac * newSpan;
      let newMax = newMin + newSpan;
      if (newMin < dataMinT) { newMin = dataMinT; newMax = dataMinT + newSpan; }
      if (newMax > dataMaxT) { newMax = dataMaxT; newMin = dataMaxT - newSpan; }
      if (newMin < dataMinT) newMin = dataMinT;
      setViewRange({ minT: newMin, maxT: newMax });
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [minT, maxT, tSpan, fullSpan, dataMinT, dataMaxT, allTrades.length, chartW, pad.l, svgW]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    setHoverTrade(null);
    dragStartRef.current = { x: e.clientX, minT, maxT };
  }, [minT, maxT]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStartRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dxPx = e.clientX - dragStartRef.current.x;
    const dxFrac = dxPx / rect.width;
    const dxT = dxFrac * svgW / chartW * tSpan;
    let newMin = dragStartRef.current.minT - dxT;
    let newMax = dragStartRef.current.maxT - dxT;
    if (newMin < dataMinT) { newMax += dataMinT - newMin; newMin = dataMinT; }
    if (newMax > dataMaxT) { newMin -= newMax - dataMaxT; newMax = dataMaxT; }
    if (newMin < dataMinT) newMin = dataMinT;
    setViewRange({ minT: newMin, maxT: newMax });
  }, [isDragging, tSpan, chartW, dataMinT, dataMaxT]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleDblClick = useCallback(() => setViewRange(null), []);

  const priceRange = Math.max(0.0001, maxP - minP);
  const rawStep = priceRange / 5;
  const stepOOM = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const niceStepVal = [1, 2, 2.5, 5, 10].reduce((best, s) => Math.abs(s * stepOOM - rawStep) < Math.abs(best * stepOOM - rawStep) ? s : best, 1) * stepOOM;
  const niceStep = Math.max(niceStepVal, 0.00001);
  const yStart = Math.floor(minP / niceStep) * niceStep;
  const yLabels: number[] = [];
  for (let y = yStart; y <= maxP + niceStep; y += niceStep) {
    yLabels.push(y);
    if (yLabels.length > 20) break;
  }
  const durationMs = maxT - minT;
  const xStepMs = durationMs > 600000 ? 120000 : durationMs > 120000 ? 30000 : durationMs > 30000 ? 10000 : 5000;
  const xStart = Math.ceil(minT / xStepMs) * xStepMs;
  const xLabels: number[] = [];
  for (let x = xStart; x <= maxT; x += xStepMs) xLabels.push(x);

  const displayFlows = showAll ? sortedFlows : sortedFlows.slice(0, 14);
  const groupBtns: {key:'all'|'top'|'mid'|'alt', label: string}[] = [
    {key:'all', label:'Tümü'}, {key:'top', label:'Tier-1'}, {key:'mid', label:'Tier-2'}, {key:'alt', label:'Diğer'},
  ];

  return (
    <div className="w-full bg-[#151925] border border-slate-800/60 rounded-xl overflow-hidden">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-slate-800/50 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"/>
          <span className="text-[10px] font-black text-cyan-100 uppercase tracking-widest">MAKER / TAKER CHART</span>
          {lastUpdate && <span className="text-[9px] text-slate-600 font-mono">{fmtTime(lastUpdate.getTime())}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['BTC-USDT','ETH-USDT','SOL-USDT','XRP-USDT','BNB-USDT'].map(s => (
            <button key={s} onClick={()=>{ setSym(s); }}
              className={cn('px-2 py-1 rounded text-[9px] font-black uppercase transition-all',
                sym===s ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-white border border-slate-800')}
            >{s.replace('-USDT','')}</button>
          ))}
          <div className="w-px h-4 bg-slate-700"/>
          {groupBtns.map(b=>(
            <button key={b.key} onClick={()=>setFilterGroup(b.key)}
              className={cn('px-1.5 py-0.5 rounded text-[8px] font-black transition-all',
                filterGroup===b.key ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white border border-slate-800')}
            >{b.label}</button>
          ))}
          <div className="w-px h-4 bg-slate-700"/>
          <button onClick={load} disabled={loading}
            className="p-1 rounded border border-slate-800 text-slate-500 hover:text-cyan-400 transition-colors">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin text-cyan-400')}/>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-slate-800/30 bg-[#1a1f30] flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-base font-black', totalNet > 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {dominantDir === 'BUY' ? '▲' : '▼'}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">NET</span>
          <span className={cn('text-xs font-black font-mono', totalNet > 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {fmtUsd(Math.abs(totalNet))}
          </span>
        </div>
        <span className="text-[9px] text-slate-600">|</span>
        <span className="text-[9px] text-emerald-400 font-mono font-black">BUY {fmtUsd(totalBuy)}</span>
        <span className="text-[9px] text-rose-400 font-mono font-black">SELL {fmtUsd(totalSell)}</span>
        <span className="text-[9px] text-slate-600">|</span>
        <span className="text-[9px] text-slate-400 font-mono">{flows.length} borsa • {aggregated.length.toLocaleString()} işlem</span>
        {selectedEx && (
          <button onClick={()=>setSelectedEx(null)} className="ml-auto text-[8px] text-cyan-400 hover:text-white border border-cyan-500/30 px-2 py-0.5 rounded">
            ✕ {selectedEx.replace('_',' ')}
          </button>
        )}
      </div>

      {loading && !flows.length ? (
        <div className="flex items-center justify-center h-[520px] gap-3 bg-slate-950/20">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400"/>
          <span className="text-slate-400 text-sm font-mono tracking-widest uppercase opacity-60">{ALL_EXCHANGES.length} BORSADAN VERİ ÇEKİLİYOR...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] divide-y xl:divide-y-0 xl:divide-x divide-slate-800/40">
          <div className="p-2 relative bg-slate-950/20 overflow-hidden flex flex-col min-h-[480px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Sankey Akış (Net Flow)</span>
              <button onClick={()=>setShowAll(!showAll)} className="text-[8px] text-violet-400 hover:text-white">
                {showAll ? 'Az' : `Tümü (${sortedFlows.length})`}
              </button>
            </div>
            
            <div className="relative w-full flex-1">
              <svg viewBox="0 0 240 440" className="w-full h-full block">
                <defs>
                  <filter id="p-glow"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                {(() => {
                  const nodeX = 10; const targetX = 180;
                  const itemH = 440 / (displayFlows.length || 1);
                  return displayFlows.map((f, idx) => {
                    const y = idx * itemH + itemH / 2;
                    const path = `M ${nodeX + 40} ${y} Q ${(nodeX + targetX) / 2} ${y}, ${targetX} 220`;
                    const isSelected = selectedEx === f.id;
                    const bColor = f.net > 0 ? '#10b981' : '#ef4444';
                    const bTrades = f.trades.sort((a,b)=>b.t - a.t).slice(0, 3);
                    return (
                      <g key={f.id} onClick={(e) => { e.stopPropagation(); setSelectedEx(isSelected ? null : f.id); }} className="cursor-pointer">
                        <path d={path} fill="none" stroke={f.color} strokeWidth={Math.max(1, (Math.abs(f.netPct)/100)*12)} strokeOpacity={isSelected ? 0.35 : 0.12} className="transition-all duration-500" />
                        <g transform={`translate(${nodeX}, ${y - 10})`}>
                          <rect width="6" height="20" fill={f.color} rx={1} fillOpacity={0.8} />
                          <text x="10" y="10" fill={isSelected ? "#fff" : "#94a3b8"} fontSize="8" fontWeight="900" className="uppercase tracking-tighter">{f.label.slice(0,8)}</text>
                          <text x="10" y="18" fill={bColor} fontSize="7" fontWeight="black" fontFamily="monospace">{f.net > 0 ? '+' : ''}{fmtUsd(f.net)}</text>
                        </g>
                        {bTrades.map((tr, ti) => {
                          const dotR = Math.min(6, Math.max(1.5, Math.sqrt(tr.usd / 500)));
                          const pDur = `${Math.max(1.2, 5 - (tr.usd / 100000)*3)}s`;
                          return (
                            <circle key={`p-${f.id}-${ti}`} r={dotR} fill={tr.side ? '#10b981' : '#ef4444'} style={{ filter: 'url(#p-glow)', opacity: 0.8 }}>
                              <animateMotion path={path} dur={pDur} begin={`${-ti * 1.5}s`} repeatCount="indefinite" />
                            </circle>
                          );
                        })}
                      </g>
                    );
                  });
                })()}
                <g transform="translate(180, 130)">
                  <rect width="30" height="180" fill="#0f172a" stroke="#1e293b" strokeWidth={1} rx={4} />
                  <text x="15" y="20" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="900" transform="rotate(90, 15, 15)">CENTRAL MARKET</text>
                  <rect width="30" height="180" fill={totalNet > 0 ? "#10b981" : "#ef4444"} fillOpacity={0.05} rx={4} />
                  <line x1="0" y1={90 - (totalNet/maxVol)*90} x2="30" y2={90 - (totalNet/maxVol)*90} stroke={totalNet > 0 ? "#10b981" : "#ef4444"} strokeWidth={2} />
                </g>
              </svg>
            </div>
          </div>

          <div className="p-2 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                {sym.replace('-USDT','/USDT')} • Tüm Borsalar ({timeframe})
                {selectedEx && <span className="text-cyan-400 ml-2">• {ALL_EXCHANGES.find(e=>e.id===selectedEx)?.label}</span>}
              </span>
              <div className="flex items-center gap-3 text-[8px] text-slate-600">
                {viewRange && (
                  <>
                    <span className="text-[8px] font-mono text-violet-400">🔍 {zoomLevel.toFixed(1)}x</span>
                    <button onClick={()=>setViewRange(null)} className="text-[8px] text-slate-400 hover:text-white border border-slate-700 px-1.5 py-0.5 rounded">Reset</button>
                    <div className="w-px h-3 bg-slate-700"/>
                  </>
                )}
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Maker Buy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>Maker Sell</span>
                <span className="text-slate-600 hidden sm:inline">• Kaydır=Pan • Scroll=Zoom • 2xTık=Sıfırla</span>
              </div>
            </div>

            {aggregated.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-slate-600 text-xs font-mono">
                {loading ? 'Yükleniyor...' : 'Veri bulunamadı — farklı coin veya süre deneyin.'}
              </div>
            ) : (
              <div className="relative w-full" style={{aspectRatio: `${svgW}/${svgH}`}}>
                <svg ref={svgRef} viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full block select-none" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDblClick}>
                  <defs>
                    <filter id="mef-wglow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    <filter id="mef-sglow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <rect x={pad.l} y={pad.t} width={chartW} height={chartH} fill="#151925"/>
                  {(() => {
                    const candleIntervalMs = candles.length > 1 ? Number(candles[1].time) - Number(candles[0].time) : 60000;
                    const candleW = Math.max(1, (candleIntervalMs / tSpan) * chartW * 0.7);
                    return candles.map((c, i) => {
                      const x = tx(Number(c.time)); if (x < pad.l || x > pad.l + chartW) return null;
                      const vH = ((c.volume || 0) / maxTotalVol) * (chartH * 0.15);
                      return <rect key={`v-${i}`} x={x - candleW/2} y={pad.t + chartH - vH} width={candleW} height={vH} fill={c.close >= c.open ? '#10b981' : '#f43f5e'} fillOpacity={0.15} />;
                    });
                  })()}
                  {(() => {
                    const candleIntervalMs = candles.length > 1 ? Number(candles[1].time) - Number(candles[0].time) : 60000;
                    const candleW = Math.max(1.8, (candleIntervalMs / tSpan) * chartW * 0.7);
                    return candles.map((c, i) => {
                      const x = tx(Number(c.time)); if (x < pad.l - 50 || x > pad.l + chartW + 50) return null;
                      const openY = ty(c.open); const closeY = ty(c.close); const highY = ty(c.high); const lowY = ty(c.low);
                      const col = c.close >= c.open ? '#10b981' : '#f43f5e';
                      return (
                        <g key={`candle-${i}`}>
                          <line x1={x} y1={highY} x2={x} y2={lowY} stroke={col} strokeWidth={1.5} strokeOpacity={0.8} />
                          <rect x={x - candleW/2} y={Math.min(openY, closeY)} width={candleW} height={Math.max(0.5, Math.abs(openY - closeY))} fill={col} fillOpacity={0.85} rx={1} />
                        </g>
                      );
                    });
                  })()}
                  {yLabels.map((price, i) => {
                    const y = ty(price); if (y < pad.t - 2 || y > pad.t + chartH + 2) return null;
                    return (
                      <g key={`yg-${i}`}>
                        <line x1={pad.l} y1={y} x2={pad.l+chartW} y2={y} stroke="#1e293b" strokeWidth={0.5}/>
                        <text x={pad.l + chartW + 5} y={y + 3} textAnchor="start" fill="#64748b" fontSize={8} fontFamily="monospace">{fmtPrice(price)}</text>
                      </g>
                    );
                  })}
                  {xLabels.map((t, i) => {
                    const x = tx(t); if (x < pad.l || x > pad.l + chartW) return null;
                    return (
                      <g key={`xg-${i}`}>
                        <line x1={x} y1={pad.t} x2={x} y2={pad.t+chartH} stroke="#1e293b" strokeWidth={0.5}/>
                        <text x={x} y={pad.t+chartH+14} textAnchor="middle" fill="#64748b" fontSize={7} fontFamily="monospace">{new Date(t).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</text>
                      </g>
                    );
                  })}
                  {[...aggregated].filter(tr => tr.usd >= 500 || tr.usd >= WHALE).sort((a,b)=>a.usd-b.usd).slice(-1000).map((tr, i) => {
                    const x = tx(tr.t); const y = ty(tr.p); const r = tSize(tr.usd) * (tr.usd >= WHALE ? 1.4 : 1.1);
                    const col = tr.side ? '#10b981' : '#ef4444';
                    if (x < pad.l || x > pad.l+chartW || y < pad.t || y > pad.t+chartH) return null;
                    const isBig = tr.usd >= labelThreshold;
                    return (
                      <g key={`dot-${i}`} className="group/bubble">
                        <circle cx={x} cy={y} r={r} fill={col} fillOpacity={tr.usd >= WHALE ? 1 : 0.85} filter={tr.usd >= WHALE ? 'url(#mef-wglow)' : isBig ? 'url(#mef-sglow)' : undefined}
                          stroke="#fff" strokeWidth={tr.usd >= WHALE ? 1.5 : 0.5} strokeOpacity={0.6} style={{cursor:'pointer'}}
                          onMouseEnter={() => setHoverTrade({ x, y, trade: tr, ex: tr.exLabel, candle: candles.find(c => Math.abs(Number(c.time) - tr.t) < 60000) })} onMouseLeave={()=>setHoverTrade(null)} />
                        {isBig && <circle cx={x} cy={y} r={r + 4} fill={col} fillOpacity={0.15} className="animate-pulse pointer-events-none" />}
                        {isBig && (
                          <g filter="url(#mef-sglow)" className="pointer-events-none">
                            <rect x={x - 25} y={y - r - 22} width={50} height={18} rx={3} fill="#020617" stroke={col} strokeWidth={1.5} />
                            <text x={x} y={y - r - 13} textAnchor="middle" fill={col} fontSize={tr.usd >= WHALE ? 10 : 8} fontWeight="900" fontFamily="monospace">{fmtUsd(tr.usd)}</text>
                            <text x={x} y={y - r - 5} textAnchor="middle" fill="#fff" fontSize={6} fontWeight="900" fontFamily="monospace" opacity="0.8">{tr.exLabel}</text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                  {curPrice > 0 && (() => {
                    const y = ty(curPrice); if (y < pad.t || y > pad.t + chartH) return null;
                    return (
                      <g>
                        <line x1={pad.l} y1={y} x2={pad.l+chartW} y2={y} stroke="#64748b" strokeWidth={0.8} strokeDasharray="4 3" strokeOpacity={0.5} />
                        <rect x={pad.l + chartW} y={y - 7} width={65} height={14} fill="#64748b" fillOpacity={0.8} rx={2} />
                        <text x={pad.l + chartW + 5} y={y + 3} fill="#fff" fontSize={8} fontWeight="bold" fontFamily="monospace">{fmtPrice(curPrice)}</text>
                      </g>
                    );
                  })()}
                  {hoverTrade && (() => {
                    const { x, y, trade, ex, candle } = hoverTrade;
                    const ttW = 160, ttH = candle ? 100 : 65;
                    const ttX = x + 12 + ttW > svgW ? x - ttW - 12 : x + 12;
                    const ttY = Math.max(pad.t, Math.min(y - ttH / 2, pad.t + chartH - ttH));
                    const col = trade.side ? '#10b981' : '#ef4444';
                    return (
                      <g className="pointer-events-none">
                        <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={6} fill="#020617" fillOpacity={0.98} stroke={col} strokeWidth={1.5}/>
                        <text x={ttX+10} y={ttY+16} fill={col} fontSize={11} fontWeight="900" fontFamily="monospace">{trade.side ? '🚀 BUY' : '🔻 SELL'} — {ex}</text>
                        <text x={ttX+10} y={ttY+32} fill="#fff" fontSize={10} fontWeight="bold" fontFamily="monospace">{fmtUsd(trade.usd)} @ {fmtPrice(trade.p)}</text>
                        <text x={ttX+10} y={ttY+46} fill="#64748b" fontSize={8} fontFamily="monospace">Time: {fmtTime(trade.t)}</text>
                        {candle && (
                          <g transform={`translate(${ttX+10}, ${ttY+58})`}>
                            <line x1={0} y1={0} x2={ttW-20} y2={0} stroke="#1e293b" strokeWidth={1} />
                            <text y={12} fill="#94a3b8" fontSize={7} fontWeight="bold" fontFamily="monospace">CANDLE DATA ({mins}m)</text>
                            <text y={24} fill="#e2e8f0" fontSize={8} fontFamily="monospace">O: {fmtPrice(candle.open)} H: {fmtPrice(candle.high)}</text>
                            <text y={34} fill="#e2e8f0" fontSize={8} fontFamily="monospace">L: {fmtPrice(candle.low)} C: {fmtPrice(candle.close)}</text>
                          </g>
                        )}
                      </g>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {flows.length > 0 && (() => {
        const whales = flows.filter(f => f.topTradeSize >= WHALE).sort((a,b)=>b.topTradeSize-a.topTradeSize).slice(0, 8);
        if (!whales.length) return null;
        return (
          <div className="border-t border-slate-800/40 px-4 py-2 bg-amber-500/10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest animate-pulse">🐳 Balina İşlemleri ({'>'} $100K)</span>
              {whales.map(f=>(
                <div key={f.id} className="flex items-center gap-1.5 bg-slate-950/80 border border-amber-500/60 rounded px-2 py-1 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-105 transition-transform">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:f.color, boxShadow: `0 0 10px ${f.color}`}}/>
                  <span className="text-[10px] font-black text-white">{f.label}</span>
                  <span className="text-[10px] font-black text-amber-400">{fmtUsd(f.topTradeSize)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
