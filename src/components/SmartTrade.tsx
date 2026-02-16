"use client";

import React, { useState } from 'react';
import { 
    Info, 
    TrendingUp, 
    ShieldAlert, 
    Zap,
    Split,
    Clock,
    Target,
    Search,
    Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HorizonCard } from './matrix-horizon/HorizonCard';
import { useHoldings } from '@/hooks/usePortfolio';
import { AssetIcon } from './AssetIcon';
import { SmartChart } from './SmartChart';
import { createSmartTrade } from '@/services/api';

type OrderType = 'LIMIT' | 'MARKET' | 'CONDITIONAL';
type TPType = 'LIMIT' | 'MARKET';
type SLType = 'COND_LIMIT' | 'COND_MARKET';

interface SmartTradeProps {
    controlledSymbol?: string;
    onSymbolChange?: (s: string) => void;
    controlledBuyPrice?: number;
    onBuyPriceChange?: (p: number) => void;
    controlledTpPrice?: number;
    onTpPriceChange?: (p: number) => void;
    controlledSlPrice?: number;
    onSlPriceChange?: (p: number) => void;
    controlledTpEnabled?: boolean;
    onTpEnabledChange?: (e: boolean) => void;
    controlledSlEnabled?: boolean;
    onSlEnabledChange?: (e: boolean) => void;
}

export const SmartTrade: React.FC<SmartTradeProps> = ({
    controlledSymbol,
    onSymbolChange,
    controlledBuyPrice,
    onBuyPriceChange,
    controlledTpPrice,
    onTpPriceChange,
    controlledSlPrice,
    onSlPriceChange,
    controlledTpEnabled,
    onTpEnabledChange,
    controlledSlEnabled,
    onSlEnabledChange,
}) => {
    // 0. External Data
    const { data: holdings = [] } = useHoldings();

    // 1. Core State
    const [useExisting, setUseExisting] = useState(false);
    const [_symbol, _setSymbol] = useState('BTC/USDT');
    const [amount, setAmount] = useState('0.15');
    const [_buyPrice, _setBuyPrice] = useState('0.4632');
    const [buyType, setBuyType] = useState<OrderType>('MARKET');
    const [trailingBuy, setTrailingBuy] = useState(false);
    const [totalUsdt, setTotalUsdt] = useState('0.00');

    // Sync helpers
    const symbol = controlledSymbol ?? _symbol;
    const setSymbol = onSymbolChange ?? _setSymbol;
    // Format buyPrice correctly for input (always string)
    const buyPrice = controlledBuyPrice !== undefined ? controlledBuyPrice.toFixed(4) : _buyPrice;
    const setBuyPrice = (val: string) => {
        if (onBuyPriceChange) onBuyPriceChange(parseFloat(val) || 0);
        else _setBuyPrice(val);
    };
    
    // Selector State
    const [searchQuery, setSearchQuery] = useState('');

    // Filtered assets for selector
    const filteredAssets = holdings.filter(h => 
        h.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Selected Holding Info
    const selectedHolding = holdings.find(h => h.symbol === symbol);

    // Handle Asset Selection
    const handleAssetSelect = (asset: typeof holdings[0]) => {
        setSymbol(asset.symbol);
        setBuyPrice(asset.price.toString());
    };

    // 2. Take Profit State
    const [internalTpEnabled, setInternalTpEnabled] = useState(true);
    const tpEnabled = controlledTpEnabled ?? internalTpEnabled;
    const setTpEnabled = onTpEnabledChange ?? setInternalTpEnabled;

    const [tpType, setTpType] = useState<TPType>('LIMIT');
    const [_tpPrice, _setTpPrice] = useState('0.5095');
    
    const tpPrice = controlledTpPrice !== undefined ? controlledTpPrice.toFixed(4) : _tpPrice;
    const setTpPrice = (val: string) => {
        if (onTpPriceChange) onTpPriceChange(parseFloat(val) || 0);
        else _setTpPrice(val);
    };

    const [tpPercent] = useState(10.00);
    const [trailingTp, setTrailingTp] = useState(false);
    const [tpDeviation, setTpDeviation] = useState(-5);

    // 3. Stop Loss State
    const [internalSlEnabled, setInternalSlEnabled] = useState(true);
    const slEnabled = controlledSlEnabled ?? internalSlEnabled;
    const setSlEnabled = onSlEnabledChange ?? setInternalSlEnabled;

    const [slType, setSlType] = useState<SLType>('COND_MARKET');
    const [_slPrice, _setSlPrice] = useState('0.4400');

    const slPrice = controlledSlPrice !== undefined ? controlledSlPrice.toFixed(4) : _slPrice;
    const setSlPrice = (val: string) => {
        if (onSlPriceChange) onSlPriceChange(parseFloat(val) || 0);
        else _setSlPrice(val);
    };

    const [slPercent] = useState(-5.00);
    const [slTimeout, setSlTimeout] = useState(false);
    const [trailingSl, setTrailingSl] = useState(false);
    const [moveToBreakeven, setMoveToBreakeven] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    // Handle Submit
    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const payload = {
                symbol,
                amount,
                buyPrice,
                buyType,
                trailingBuy,
                takeProfit: tpEnabled ? {
                    type: tpType,
                    price: tpPrice,
                    trailing: trailingTp,
                    deviation: tpDeviation
                } : null,
                stopLoss: slEnabled ? {
                    type: slType,
                    price: slPrice,
                    timeout: slTimeout,
                    trailing: trailingSl,
                    breakeven: moveToBreakeven
                } : null
            };
            
            await createSmartTrade(payload as Record<string, unknown>);
            alert('SmartTrade başarıyla oluşturuldu!');
        } catch (error) {
            console.error('SmartTrade submission failed:', error);
            alert('Hata: İşlem oluşturulamadı.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <HorizonCard className="bg-[#020617]/40 backdrop-blur-xl border-slate-800/50 p-6 shadow-2xl overflow-hidden group/smart" glowColor="cyan">
             {/* Header Section: Fully Centered Layout */}
             <div className="flex flex-col items-center gap-6 mb-10 pb-6 border-b border-white/5">
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        <Target className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-[0.3em]">SmartTrade Planlayıcı</h2>
                        <div className="flex items-center justify-center gap-2 mt-1.5">
                            <Info className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider italic">Profesyonel İşlem Terminali</span>
                        </div>
                    </div>
                </div>

                {/* Centered Search */}
                <div className="relative group/search w-full max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within/search:text-cyan-500 transition-colors" />
                    <input 
                        type="text"
                        placeholder="İşlem yapılacak varlığı arayın..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-cyan-500/40 focus:bg-slate-900/80 transition-all text-center"
                    />
                </div>
             </div>

             {/* Centered Asset Tiles */}
             <div className="mb-12 space-y-6">
                <div className="flex items-center justify-center gap-3">
                    <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-800" />
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/40 border border-slate-800/50">
                        <Wallet className="w-3.5 h-3.5 text-cyan-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aktif Portföyüm</span>
                    </div>
                    <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-800" />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-5xl mx-auto px-4">
                    {filteredAssets.length > 0 ? filteredAssets.slice(0, 16).map((asset) => (
                        <button
                            key={asset.id}
                            onClick={() => handleAssetSelect(asset)}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative group overflow-hidden min-w-[100px] hover:scale-105 active:scale-95",
                                symbol === asset.symbol 
                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20" 
                                    : "bg-slate-900/40 border-slate-800/50 hover:border-slate-600/50 hover:bg-slate-800/60"
                            )}
                        >
                            {symbol === asset.symbol && (
                                <div className="absolute top-0 right-0 p-1.5">
                                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                                </div>
                            )}
                            <AssetIcon symbol={asset.symbol} size={32} />
                            <div className="text-center">
                                <div className="text-[11px] font-black text-white tracking-tight">{asset.symbol.split('/')[0]}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{asset.holding.toFixed(2)}</div>
                            </div>
                            
                            {/* Hover Price Info */}
                            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                                <span className="text-[10px] font-black text-cyan-400 shadow-cyan-400/20">${asset.price.toLocaleString()}</span>
                            </div>
                        </button>
                    )) : null}
                    
                    {filteredAssets.length === 0 && (
                        <div className="w-full max-w-lg py-12 text-center bg-slate-900/20 border border-dashed border-slate-800/50 rounded-3xl mx-auto">
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-[0.2em]">Varlık bulunamadı</span>
                        </div>
                    )}
                </div>
             </div>
             
             {/* Integrated SmartChart Section */}
             <div className="mb-12">
                <SmartChart 
                    symbol={symbol}
                    buyPrice={parseFloat(buyPrice)}
                    tpPrice={parseFloat(tpPrice)}
                    slPrice={parseFloat(slPrice)}
                    onPricesChange={(p) => {
                        if (p.buy !== undefined) setBuyPrice(p.buy.toString());
                        if (p.tp !== undefined) setTpPrice(p.tp.toString());
                        if (p.sl !== undefined) setSlPrice(p.sl.toString());
                    }}
                    tpEnabled={tpEnabled}
                    slEnabled={slEnabled}
                />
             </div>

             {/* Main Grid: 3 Columns */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUMN 1: UNITS & BUY PRICE */}
                <div className="space-y-8">
                    {/* Units Section */}
                    <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Birimler</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Varlıkları Kullan</span>
                                <button 
                                    onClick={() => setUseExisting(!useExisting)}
                                    className={cn(
                                        "w-8 h-4 rounded-full transition-all relative px-0.5",
                                        useExisting ? "bg-cyan-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        useExisting ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                         </div>
                         
                         <div className="relative group/input">
                            <input 
                                type="text" 
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white focus:border-cyan-500/50 outline-none transition-all"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">{symbol.split('/')[0]}</div>
                         </div>
                         
                         {selectedHolding && (
                             <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <Wallet className="w-3 h-3" />
                                    <span className="text-[9px] font-bold uppercase tracking-tighter">Bakiye: {selectedHolding.holding.toFixed(4)} {symbol.split('/')[0]}</span>
                                </div>
                                <button 
                                    onClick={() => setAmount(selectedHolding.holding.toString())}
                                    className="text-[9px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest"
                                >
                                    MAX
                                </button>
                             </div>
                         )}

                         <div className="flex items-center gap-1.5 text-rose-400">
                            <ShieldAlert className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">İşlem {symbol.split('/')[0]} bazında hesaplanacaktır.</span>
                         </div>
                    </div>

                    {/* Buy Price Section */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Alış Fiyatı</h3>
                        <div className="p-1 bg-slate-950/50 rounded-lg grid grid-cols-3 gap-1">
                            {(['LIMIT', 'MARKET', 'CONDITIONAL'] as OrderType[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setBuyType(t)}
                                    className={cn(
                                        "py-1.5 text-[9px] font-black rounded transition-all uppercase",
                                        buyType === t ? "bg-slate-800 text-white shadow-lg" : "text-slate-400 hover:text-slate-300"
                                    )}
                                >
                                    {t === 'CONDITIONAL' ? 'KOŞ.' : t}
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative">
                            <input 
                                type="text" 
                                value={buyPrice} 
                                onChange={(e) => setBuyPrice(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none"
                                disabled={buyType === 'MARKET'}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono tracking-tighter">Bid: {selectedHolding ? (selectedHolding.price * 0.9999).toFixed(4) : buyPrice}</span>
                            <span className="text-[10px] font-bold text-rose-400 uppercase font-mono tracking-tighter">Ask: {selectedHolding ? (selectedHolding.price * 1.0001).toFixed(4) : buyPrice}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trailing Buy</span>
                                <Info className="w-3 h-3 text-slate-700" />
                            </div>
                            <button 
                                onClick={() => setTrailingBuy(!trailingBuy)}
                                className={cn(
                                    "w-8 h-4 rounded-full transition-all relative px-0.5",
                                    trailingBuy ? "bg-cyan-500" : "bg-slate-700"
                                )}
                            >
                                <div className={cn(
                                    "w-3 h-3 bg-white rounded-full transition-all",
                                    trailingBuy ? "translate-x-4" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                    </div>

                    {/* Total Section */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Toplam</h3>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={totalUsdt}
                                onChange={(e) => setTotalUsdt(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                             {[5, 10, 25, 50, 100].map(p => (
                                <button key={p} className="py-1.5 rounded-lg border border-white/5 bg-white/5 text-[9px] font-black text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                    {p}%
                                </button>
                             ))}
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: TAKE PROFIT */}
                <div className="space-y-8 bg-slate-950/20 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                        <TrendingUp className="w-48 h-48 text-emerald-500" />
                    </div>
                    
                    <div className="flex items-center justify-between relative z-10">
                         <h3 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Kar Al
                         </h3>
                         <button 
                            onClick={() => setTpEnabled(!tpEnabled)}
                            className={cn(
                                "w-10 h-5 rounded-full transition-all relative px-1",
                                tpEnabled ? "bg-emerald-500" : "bg-slate-700"
                            )}
                        >
                            <div className={cn(
                                "w-3 h-3 bg-white rounded-full transition-all",
                                tpEnabled ? "translate-x-5" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    <div className={cn("space-y-6 transition-opacity duration-300 relative z-10", !tpEnabled && "opacity-30 pointer-events-none")}>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/50 rounded-lg">
                            {(['LIMIT', 'MARKET'] as TPType[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setTpType(t)}
                                    className={cn(
                                        "py-2 text-[9px] font-black rounded transition-all uppercase",
                                        tpType === t ? "bg-emerald-500 text-slate-950 shadow-lg" : "text-slate-400 hover:text-slate-300"
                                    )}
                                >
                                    {t} EMİR
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hedef Fiyat</span>
                                <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">+{tpPercent.toFixed(2)}%</span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={tpPrice}
                                    onChange={(e) => setTpPrice(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                            </div>
                        </div>

                        <button className="w-full py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2 group/split">
                            <Split className="w-4 h-4 text-emerald-400 group-hover/split:rotate-12 transition-transform" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hedefleri Böl</span>
                        </button>

                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trailing Take Profit</span>
                                    <Info className="w-3 h-3 text-slate-700" />
                                </div>
                                <button 
                                    onClick={() => setTrailingTp(!trailingTp)}
                                    className={cn(
                                        "w-8 h-4 rounded-full transition-all relative px-0.5",
                                        trailingTp ? "bg-emerald-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        trailingTp ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                            
                            {trailingTp && (
                                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">
                                        <span>Fiyat Sapma Payı</span>
                                        <span>{tpDeviation}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="-10" max="0" step="0.5" 
                                        value={tpDeviation}
                                        onChange={(e) => setTpDeviation(parseFloat(e.target.value))}
                                        className="w-full accent-emerald-500 h-1 rounded-full cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: STOP LOSS */}
                <div className="space-y-8 bg-slate-950/20 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                        <ShieldAlert className="w-48 h-48 text-rose-500" />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                         <h3 className="text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> Stop Loss
                         </h3>
                         <button 
                            onClick={() => setSlEnabled(!slEnabled)}
                            className={cn(
                                "w-10 h-5 rounded-full transition-all relative px-1",
                                slEnabled ? "bg-rose-500" : "bg-slate-700"
                            )}
                        >
                            <div className={cn(
                                "w-3 h-3 bg-white rounded-full transition-all",
                                slEnabled ? "translate-x-5" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    <div className={cn("space-y-6 transition-opacity duration-300 relative z-10", !slEnabled && "opacity-30 pointer-events-none")}>
                        <div className="grid grid-cols-1 gap-1 p-1 bg-slate-950/50 rounded-lg">
                            {(['COND_LIMIT', 'COND_MARKET'] as SLType[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setSlType(t)}
                                    className={cn(
                                        "py-2 text-[9px] font-black rounded transition-all uppercase",
                                        slType === t ? "bg-rose-500 text-slate-950 shadow-lg" : "text-slate-400 hover:text-slate-300"
                                    )}
                                >
                                    KOŞ. {t.includes('LIMIT') ? 'LİMİT' : 'PİYASA'} EMİR
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                             <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stop Seviyesi</span>
                                <span className="text-[10px] font-black text-rose-400 font-mono tracking-tighter">{slPercent.toFixed(2)}%</span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={slPrice}
                                    onChange={(e) => setSlPrice(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/5">
                            {/* Timeout */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> Stop Loss Timeout</span>
                                    <Info className="w-3 h-3 text-slate-700" />
                                </div>
                                <button 
                                    onClick={() => setSlTimeout(!slTimeout)}
                                    className={cn(
                                        "w-8 h-4 rounded-full transition-all relative px-0.5",
                                        slTimeout ? "bg-rose-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        slTimeout ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Trailing Stop Loss */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trailing Stop Loss</span>
                                <button 
                                    onClick={() => setTrailingSl(!trailingSl)}
                                    className={cn(
                                        "w-8 h-4 rounded-full transition-all relative px-0.5",
                                        trailingSl ? "bg-rose-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        trailingSl ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Move to Breakeven */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakeven&apos;a Taşı</span>
                                <button 
                                    onClick={() => setMoveToBreakeven(!moveToBreakeven)}
                                    className={cn(
                                        "w-8 h-4 rounded-full transition-all relative px-0.5",
                                        moveToBreakeven ? "bg-rose-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        moveToBreakeven ? "translate-x-4" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Footer Action */}
             <div className="mt-12 flex flex-col md:flex-row items-center justify-between pt-6 border-t border-white/5 relative z-10 gap-6">
                <div className="flex p-0.5 rounded-xl bg-slate-950/50 border border-white/5 divide-x divide-white/10 w-full md:w-auto">
                    <div className="px-4 py-2 flex-1">
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Hesaplanan Kar</div>
                        <div className="text-xs font-black text-emerald-400 font-mono tracking-tighter line-clamp-1">$0.00 (10.00%)</div>
                    </div>
                    <div className="px-4 py-2 flex-1">
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Maksimum Risk</div>
                        <div className="text-xs font-black text-rose-400 font-mono tracking-tighter line-clamp-1">-$0.00 (-5.00%)</div>
                    </div>
                    <div className="px-4 py-2 flex-1 hidden sm:block">
                        <div className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Risk/Ödül</div>
                        <div className="text-xs font-black text-white font-mono tracking-tighter line-clamp-1">1 : 2.0</div>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                     <button className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-slate-700 hover:text-slate-300 transition-all">
                        TEMİZLE
                     </button>
                     <button 
                        disabled={isLoading}
                        onClick={handleSubmit}
                        className={cn(
                            "flex-[2] md:flex-none px-10 py-3 rounded-xl text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3",
                            isLoading ? "bg-slate-700 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/20"
                        )}
                    >
                        {isLoading ? (
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        )}
                        {isLoading ? 'OLUŞTURULUYOR...' : 'SmartTrade Oluştur'}
                     </button>
                </div>
             </div>
        </HorizonCard>
    );
};
