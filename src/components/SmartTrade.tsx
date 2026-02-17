"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Info, 
    TrendingUp, 
    ShieldAlert, 
    Zap,
    Split,
    Wallet,
    ArrowRightLeft,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HorizonCard } from './matrix-horizon/HorizonCard';
import { useHoldings } from '@/hooks/usePortfolio';
import { AssetIcon } from './AssetIcon';
import { SmartChart } from './SmartChart';
import { createSmartTrade, api } from '@/services/api';
import { SmartTradeOrder } from './ActiveSmartTrades';

type OrderType = 'LIMIT' | 'MARKET' | 'CONDITIONAL';
type TPType = 'LIMIT' | 'MARKET';
type SLType = 'COND_LIMIT' | 'COND_MARKET';

interface SmartTradeProps {
    controlledSymbol?: string;
    onSymbolChange?: (s: string) => void;
    controlledBuyPrice?: string | number;
    onBuyPriceChange?: (p: string) => void;
    controlledTpPrice?: string | number;
    onTpPriceChange?: (p: string) => void;
    controlledSlPrice?: string | number;
    onSlPriceChange?: (p: string) => void;
    controlledTpEnabled?: boolean;
    onTpEnabledChange?: (e: boolean) => void;
    controlledSlEnabled?: boolean;
    onSlEnabledChange?: (e: boolean) => void;
    editingTrade?: SmartTradeOrder;
    onCancelEdit?: () => void;
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
    editingTrade,
    onCancelEdit,
}) => {
    // 0. External Data
    const { data: holdings = [] } = useHoldings();

    // 1. Core State
    const [mode, setMode] = useState<'TRADE' | 'COVER'>('TRADE');
    const [useExisting, setUseExisting] = useState(true);
    const [_symbol, _setSymbol] = useState('BTC/USDT');
    const [amount, setAmount] = useState('0');
    const [allocationPercent, setAllocationPercent] = useState(0);
    const [_buyPrice, _setBuyPrice] = useState('0');
    const [buyType] = useState<OrderType>('MARKET');
    const [trailingBuy, setTrailingBuy] = useState(false);
    const [trailingBuyDev, setTrailingBuyDev] = useState(1.0);

    // Sync helpers
    const symbol = controlledSymbol ?? _symbol;
    const setSymbol = onSymbolChange ?? _setSymbol;
    // Format buyPrice correctly for input (always string)
    const buyPrice = controlledBuyPrice !== undefined ? (typeof controlledBuyPrice === 'number' ? controlledBuyPrice.toString() : controlledBuyPrice) : _buyPrice;
    const setBuyPrice = useCallback((val: string) => {
        if (onBuyPriceChange) onBuyPriceChange(val);
        else _setBuyPrice(val);
    }, [onBuyPriceChange]);
    
    // Selector State (filtering was removed, use holdings directly)
    const filteredAssets = holdings;

    // Selected Holding Info (Handle both "CGPT" and "CGPT/USDT" formats)
    const selectedHolding = holdings.find(h => {
        const hSym = h.symbol.split('/')[0];
        const sSym = symbol.split('/')[0];
        return hSym === sSym;
    });

    // 2. Take Profit State
    const [internalTpEnabled, setInternalTpEnabled] = useState(true);
    const tpEnabled = controlledTpEnabled ?? internalTpEnabled;
    const setTpEnabled = onTpEnabledChange ?? setInternalTpEnabled;

    const [tpType] = useState<TPType>('MARKET');
    const [_tpPrice, _setTpPrice] = useState('0');
    
    const tpPrice = controlledTpPrice !== undefined ? (typeof controlledTpPrice === 'number' ? controlledTpPrice.toString() : controlledTpPrice) : _tpPrice;
    const setTpPrice = useCallback((val: string) => {
        if (onTpPriceChange) onTpPriceChange(val);
        else _setTpPrice(val);
    }, [onTpPriceChange]);

    const [trailingTp, setTrailingTp] = useState(false);
    const [tpDeviation, setTpDeviation] = useState(-1.0);
    
    // Split TP Targets
    const [isSplitTp, setIsSplitTp] = useState(false);
    const [tpTargets, setTpTargets] = useState<{ id: string; price: string; volume: number }[]>([
        { id: '1', price: _tpPrice, volume: 100 }
    ]);

    const addTpTarget = useCallback(() => {
        if (tpTargets.length >= 8) return;
        const lastTarget = tpTargets[tpTargets.length - 1];
        const buyP = parseFloat(buyPrice) || 0;
        const lastP = parseFloat(lastTarget.price) || buyP;
        // Default next target: +5% for Trade, -5% for Cover
        const newPrice = mode === 'COVER' ? lastP * 0.95 : lastP * 1.05;
        
        // Calculate remaining volume
        const currentTotal = tpTargets.reduce((sum, t) => sum + t.volume, 0);
        const remaining = Math.max(0, 100 - currentTotal);

        setTpTargets([...tpTargets, { 
            id: Math.random().toString(36).substring(2, 9), 
            price: newPrice.toFixed(4), 
            volume: remaining > 0 ? 10 : 0 
        }]);
    }, [tpTargets, buyPrice, mode]);

    const removeTpTarget = useCallback((id: string) => {
        if (tpTargets.length <= 1) {
            setIsSplitTp(false);
            return;
        }
        setTpTargets(prev => prev.filter(t => t.id !== id));
    }, [tpTargets.length]);

    const updateTpTarget = useCallback((id: string, updates: Partial<{ price: string; volume: number }>) => {
        setTpTargets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const totalTpVolume = tpTargets.reduce((sum, t) => sum + t.volume, 0);

    const [marketPrice, setMarketPrice] = useState<number | null>(null);

    // 3. Stop Loss State
    const [internalSlEnabled, setInternalSlEnabled] = useState(true);
    const slEnabled = controlledSlEnabled ?? internalSlEnabled;
    const setSlEnabled = onSlEnabledChange ?? setInternalSlEnabled;

    const [slType] = useState<SLType>('COND_MARKET');
    const [_slPrice, _setSlPrice] = useState('0');

    const slPrice = controlledSlPrice !== undefined ? (typeof controlledSlPrice === 'number' ? controlledSlPrice.toString() : controlledSlPrice) : _slPrice;
    const setSlPrice = useCallback((val: string) => {
        if (onSlPriceChange) onSlPriceChange(val);
        else _setSlPrice(val);
    }, [onSlPriceChange]);


    const [trailingSl, setTrailingSl] = useState(false);
    const [trailingSlDev, setTrailingSlDev] = useState(-1.0);
    const [moveToBreakeven, setMoveToBreakeven] = useState(false);

    // Handle Asset Selection
    const handleAssetSelect = useCallback((asset: typeof holdings[0]) => {
        // Formata göre ayarla: Eğer NST ise NST/USDT yap, USDT ise BTC/USDT'ye dön
        let newSymbol = asset.symbol === 'USDT' ? 'BTC/USDT' : asset.symbol;
        
        if (!newSymbol.includes('/')) {
            if (newSymbol.endsWith('USDT')) {
                newSymbol = newSymbol.replace('USDT', '/USDT');
            } else {
                newSymbol = `${newSymbol}/USDT`;
            }
        }
                
        setSymbol(newSymbol);
        const currentPrice = asset.price;
        setBuyPrice(currentPrice.toString());
        
        // Calculate logical targets (+9% / -10%)
        const defaultTp = currentPrice * 1.09;
        const defaultSl = currentPrice * 0.90;
        
        setTpPrice(defaultTp.toFixed(6));
        setSlPrice(defaultSl.toFixed(6));
        
        // Reset amount and allocation when switching assets
        setAmount('0');
        setAllocationPercent(0);
    }, [setSymbol, setBuyPrice, setTpPrice, setSlPrice]);

    const [isLoading, setIsLoading] = useState(false);

    // Sync buyPrice with marketPrice if we're using existing assets (or if buyPrice is empty)
    useEffect(() => {
        if (marketPrice !== null && marketPrice > 0 && !editingTrade) {
            // Only auto-sync Buy Price if we are using existing assets. 
            // If buying new (useExisting=false), we want the user to set a manual baseline for Trailing Buy.
            if (useExisting || !buyPrice || buyPrice === '0') {
                setBuyPrice(marketPrice.toString());
            }
        }
    }, [marketPrice, setBuyPrice, editingTrade, useExisting, buyPrice]);

    // Auto-select highest value asset on mount (by USDT value, not quantity)
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (holdings.length > 0 && !hasInitialized && !editingTrade) {
            // Filter out stablecoins and zero-balance assets
            const tradableAssets = holdings.filter(h => 
                h.symbol !== 'USDT' && 
                h.symbol !== 'USDC' && 
                h.holding > 0
            );
            
            // Find asset with highest USDT value (holding * price)
            if (tradableAssets.length > 0) {
                const highestValueAsset = tradableAssets.reduce((max, asset) => {
                    const maxValue = max.holding * max.price;
                    const assetValue = asset.holding * asset.price;
                    return assetValue > maxValue ? asset : max;
                });
                
                if (highestValueAsset) {
                    handleAssetSelect(highestValueAsset);
                }
            } else if (holdings[0]) {
                handleAssetSelect(holdings[0]);
            }
            
            setHasInitialized(true);
        }
    }, [holdings, hasInitialized, handleAssetSelect, editingTrade]);

    // Populate from editingTrade
    useEffect(() => {
        if (editingTrade) {
            setHasInitialized(true); // Don't auto-select if we have an edit target
            const p = editingTrade.meta.payload;
            setMode(editingTrade.meta.mode as 'TRADE' | 'COVER');
            setSymbol(editingTrade.symbol);
            setAmount(p.amount);
            setBuyPrice(p.buyPrice);
            
            // TP
            if (p.takeProfit) {
                setTpEnabled(true);
                setTpPrice(p.takeProfit.price);
                setTrailingTp(!!p.takeProfit.trailing);
                setTpDeviation(p.takeProfit.deviation || -1.0);
                setIsSplitTp(!!p.takeProfit.isSplit);
                if (p.takeProfit.targets) {
                    setTpTargets(p.takeProfit.targets.map((t: { price: string; volume: string }, i: number) => ({
                        id: String(i),
                        price: t.price,
                        volume: parseFloat(t.volume)
                    })));
                }
            } else {
                setTpEnabled(false);
            }

            // SL
            if (p.stopLoss) {
                setSlEnabled(true);
                setSlPrice(p.stopLoss.price);
                setTrailingSl(!!p.stopLoss.trailing);
                setTrailingSlDev(p.stopLoss.deviation || -1.0);
                setMoveToBreakeven(!!p.stopLoss.breakeven);
            } else {
                setSlEnabled(false);
            }
        }
    }, [editingTrade, setSymbol, setBuyPrice, setTpEnabled, setTpPrice, setSlEnabled, setSlPrice]);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const payload = {
                mode, // 'TRADE' | 'COVER'
                symbol,
                amount,
                buyPrice,
                buyType,
                useExisting,
                trailingBuy,
                trailingBuyDev,
                takeProfit: tpEnabled ? {
                    type: tpType,
                    price: tpPrice,
                    isSplit: isSplitTp,
                    targets: isSplitTp ? tpTargets.map(t => ({
                        price: t.price,
                        volume: t.volume
                    })) : null,
                    trailing: trailingTp,
                    deviation: tpDeviation
                } : null,
                stopLoss: slEnabled ? {
                    type: slType,
                    price: slPrice,
                    trailing: trailingSl,
                    deviation: trailingSlDev,
                    breakeven: moveToBreakeven
                } : null
            };
            
            if (editingTrade) {
                await api.put(`/trade/smart?id=${editingTrade.id}`, payload);
                alert('Değişiklikler başarıyla kaydedildi!');
                if (onCancelEdit) onCancelEdit();
            } else {
                await createSmartTrade(payload as Record<string, unknown>);
                alert('SmartTrade başarıyla oluşturuldu!');
            }
        } catch (error) {
            console.error('SmartTrade submission failed:', error);
            alert('Hata: İşlem gerçekleştirilemedi.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePricesChange = useCallback((p: { buy?: number; tp?: number; sl?: number }) => {
        if (p.buy !== undefined) setBuyPrice(p.buy.toString());
        if (p.tp !== undefined) setTpPrice(p.tp.toString());
        if (p.sl !== undefined) setSlPrice(p.sl.toString());
    }, [setBuyPrice, setTpPrice, setSlPrice]);

    // Dynamic calculations
    const buyP = parseFloat(buyPrice) || 0;
    const tpP = parseFloat(tpPrice) || 0;
    const slP = parseFloat(slPrice) || 0;
    const amt = parseFloat(amount) || 0;
    const tpPercent = buyP > 0 ? ((tpP / buyP) - 1) * 100 : 0;
    const slPercent = buyP > 0 ? ((slP / buyP) - 1) * 100 : 0;
    
    // Display values flip for COVER mode
    const displayTpPercent = mode === 'COVER' ? -tpPercent : tpPercent;
    const displaySlPercent = mode === 'COVER' ? -slPercent : slPercent;

    const profitUsdt = mode === 'COVER' ? amt * (buyP - tpP) : amt * (tpP - buyP);
    const riskUsdt = mode === 'COVER' ? amt * (slP - buyP) : amt * (buyP - slP);
    const riskReward = riskUsdt > 0 ? (profitUsdt / riskUsdt).toFixed(1) : '∞';
    const computedTotal = (amt * buyP).toFixed(2);

    return (
        <HorizonCard className="bg-[#020617]/40 backdrop-blur-xl border-slate-800/50 p-4 shadow-2xl overflow-hidden group/smart" glowColor={mode === 'COVER' ? "emerald" : "cyan"}>
            {editingTrade && (
                <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                            İŞLEM DÜZENLEME MODU: {editingTrade.symbol} (ID: {editingTrade.id})
                        </span>
                    </div>
                    <button 
                        onClick={onCancelEdit}
                        className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 transition-all"
                    >
                        İPTAL ET
                    </button>
                </div>
            )}
            
            {/* Centered Asset Tiles */}
             <div className="mb-4 space-y-4">
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
                                symbol.split('/')[0] === asset.symbol 
                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20" 
                                    : "bg-slate-900/40 border-slate-800/50 hover:border-slate-600/50 hover:bg-slate-800/60"
                            )}
                        >
                            {symbol.startsWith(asset.symbol) && (
                                <div className="absolute top-0 right-0 p-1.5">
                                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                                </div>
                            )}
                            <div className="relative z-20">
                                <AssetIcon symbol={asset.symbol} size={32} />
                            </div>
                            <div className="text-center relative z-20">
                                <div className="text-[11px] font-black text-white tracking-tight">
                                    {(() => {
                                        const b = asset.symbol.split(/[/_-]/)[0];
                                        const quotes = ['USDT', 'USDC', 'BUSD', 'TUSD', 'BTC', 'ETH', 'BNB'];
                                        for (const q of quotes) {
                                            if (b.endsWith(q) && b.length > q.length) return b.substring(0, b.length - q.length);
                                        }
                                        return b;
                                    })()}
                                </div>
                                <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-tighter mt-1 group-hover:hidden transition-all">{asset.holding.toFixed(2)}</div>
                                <div className="text-[9px] font-black text-cyan-400 mt-1 hidden group-hover:block transition-all animate-in fade-in slide-in-from-bottom-1">${asset.price.toLocaleString()}</div>
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
             <div className="mb-4">
                <SmartChart 
                    symbol={symbol}
                    buyPrice={parseFloat(buyPrice)}
                    tpPrice={parseFloat(tpPrice)}
                    slPrice={parseFloat(slPrice)}
                    onPricesChange={handlePricesChange}
                    tpEnabled={tpEnabled}
                    slEnabled={slEnabled}
                    trailingBuy={trailingBuy}
                    onTrailingBuyChange={setTrailingBuy}
                    trailingSl={trailingSl}
                    onTrailingSlChange={setTrailingSl}
                    trailingTp={trailingTp}
                    onTrailingTpChange={setTrailingTp}
                    currentMarketPrice={selectedHolding?.price}
                    onMarketPriceUpdate={setMarketPrice}
                />
             </div>

             {/* Main Grid: 3 Columns */}
             <div id="smart-trade-controls" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* COLUMN 1: UNITS & BUY PRICE */}
                <div className="space-y-4">
                    {/* Units Section */}
                    <div className="space-y-4">
                        {/* Header with Toggle */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                {mode === 'COVER' ? 'Satış Miktarı' : 'Birimler'}
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Varlıkları Kullan</span>
                                <button 
                                    onClick={() => setUseExisting(!useExisting)}
                                    className={cn(
                                        "w-10 h-5 rounded-full transition-all relative px-1",
                                        useExisting ? "bg-cyan-500" : "bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "w-3 h-3 bg-white rounded-full transition-all",
                                        useExisting ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>

                        {/* Asset Info (when enabled) */}
                        {useExisting && selectedHolding && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                                <div className="flex items-center gap-2">
                                    <AssetIcon symbol={selectedHolding.symbol} size={20} />
                                    <span className="text-sm font-black text-white">{selectedHolding.symbol}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">Mevcut</div>
                                    <div className="text-xs font-black text-cyan-400 font-mono">
                                        {selectedHolding.holding.toFixed(4)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Amount Input with MAX Button */}
                        <div className="relative">
                            <input 
                                type="text" 
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value);
                                    // Update percentage based on manual input
                                    if (useExisting && selectedHolding && parseFloat(e.target.value) > 0) {
                                        const pct = (parseFloat(e.target.value) / selectedHolding.holding) * 100;
                                        setAllocationPercent(Math.min(100, pct));
                                    }
                                }}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none pr-24 focus:border-cyan-500/50 transition-all"
                            />
                            <div className="absolute right-14 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">{symbol.split('/')[0]}</div>
                            {useExisting && selectedHolding && (
                                <button
                                    onClick={() => {
                                        setAmount(selectedHolding.holding.toFixed(4));
                                        setAllocationPercent(100);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase hover:bg-cyan-500/30 transition-all"
                                >
                                    MAX
                                </button>
                            )}
                        </div>

                        {/* Percentage Slider (Ratio) */}
                        {useExisting && selectedHolding && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                    <span>Oran</span>
                                    <span className="text-cyan-400">{allocationPercent.toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="5" 
                                    value={allocationPercent}
                                    onChange={(e) => {
                                        const pct = parseFloat(e.target.value);
                                        setAllocationPercent(pct);
                                        const calculatedAmount = (selectedHolding.holding * pct) / 100;
                                        setAmount(calculatedAmount.toFixed(4));
                                    }}
                                    className="w-full accent-cyan-500 h-2 rounded-full cursor-pointer"
                                />
                                <div className="flex justify-between text-[8px] font-bold text-slate-600">
                                    <span>0%</span>
                                    <span>25%</span>
                                    <span>50%</span>
                                    <span>75%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        )}

                        {/* Total Section Moved Here */}
                        <div className="space-y-4 pt-6 mt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Toplam</h3>
                                <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-tighter">ESTIMATED</div>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={computedTotal}
                                    readOnly
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none cursor-default"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {[5, 10, 25, 50, 100].map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => {
                                            if (useExisting && selectedHolding) {
                                                setAllocationPercent(p);
                                                const calculatedAmount = (selectedHolding.holding * p) / 100;
                                                setAmount(calculatedAmount.toFixed(4));
                                            }
                                        }}
                                        className="py-1.5 rounded-lg border border-white/5 bg-white/5 text-[9px] font-black text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Buy Price Section */}
                    {!useExisting && (
                        <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                    {mode === 'COVER' ? 'Satış Fiyatı (Giriş)' : 'Alış Fiyatı'}
                                </h3>
                            </div>

                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={buyPrice} 
                                    onChange={(e) => setBuyPrice(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                            </div>
                            
                            <div className="space-y-3">
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
                                {trailingBuy && (
                                    <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex justify-between text-[9px] font-bold text-cyan-400 uppercase tracking-tighter">
                                            <span>Trailing Sapma</span>
                                            <span>{trailingBuyDev}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0.1" max="5" step="0.1" 
                                            value={trailingBuyDev}
                                            onChange={(e) => setTrailingBuyDev(parseFloat(e.target.value))}
                                            className="w-full accent-cyan-500 h-1 rounded-full cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUMN 2: SUMMARY & ACTIONS */}
                <div className="flex flex-col space-y-4">
                    {/* Mode Switcher Integrated Here */}
                    <div className="flex flex-col items-center gap-2 mb-2">
                        <div className="w-full text-center mb-1 h-3 flex items-center justify-center">
                            {mode === 'TRADE' ? (
                                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                                    Smart Trade: Düşükten alıp yüksekten satarak kâr elde etmenizi sağlar.
                                </span>
                            ) : (
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                                    Smart Cover: Varlığı yüksekten satıp alttan alarak adet artırmanızı sağlar.
                                </span>
                            )}
                        </div>
                        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/50 backdrop-blur-md w-full">
                            <button 
                                onClick={() => setMode('TRADE')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    mode === 'TRADE' 
                                        ? "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]" 
                                        : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                <Zap className={cn("w-3.5 h-3.5", mode === 'TRADE' ? "fill-white/20" : "")} />
                                Smart Trade
                            </button>
                            <button 
                                onClick={() => setMode('COVER')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    mode === 'COVER' 
                                        ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
                                        : "text-slate-500 hover:text-slate-300"
                                )}
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                Smart Cover
                            </button>
                        </div>
                        <div className={cn(
                            "px-4 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] animate-in fade-in zoom-in-95",
                            mode === 'COVER' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                        )}>
                            {mode === 'COVER' ? 'Varlık Biriktirme' : 'Standart Al/Sat'}
                        </div>
                    </div>
                    <div className="bg-slate-950/40 p-6 rounded-3xl border border-white/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 shadow-2xl relative overflow-hidden group/summary">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover/summary:opacity-[0.05] transition-opacity">
                            <Zap className="w-32 h-32 text-cyan-500" />
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 pb-3">
                                {mode === 'COVER' ? 'Varlık Biriktirme Özeti' : 'Standart Al/Sat Özeti'}
                            </h3>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-1">
                                        {mode === 'COVER' ? 'Tahmini Kazanç' : 'Hesaplanan Kar'}
                                    </div>
                                    <div className="text-xl font-black text-emerald-400 font-mono tracking-tighter">
                                        ${profitUsdt.toFixed(2)} ({displayTpPercent >= 0 ? '+' : ''}{displayTpPercent.toFixed(2)}%)
                                    </div>
                                </div>
                                
                                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-1">
                                        {mode === 'COVER' ? 'Tahmini Kayıp' : 'Maksimum Risk'}
                                    </div>
                                    <div className="text-xl font-black text-rose-400 font-mono tracking-tighter">
                                        -${riskUsdt.toFixed(2)} ({displaySlPercent >= 0 ? '+' : ''}{displaySlPercent.toFixed(2)}%)
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-1">Risk/Ödül</div>
                                    <div className="text-xl font-black text-white font-mono tracking-tighter">1 : {riskReward}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <button 
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className={cn(
                                    "w-full py-4 rounded-2xl text-[13px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group/submit shadow-xl",
                                    mode === 'COVER' 
                                        ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                                        : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/20",
                                    isLoading && "opacity-50 cursor-wait"
                                )}
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/submit:translate-y-0 transition-transform duration-500" />
                                <span className="relative z-10 flex items-center justify-center gap-3 text-slate-950 font-black">
                                    {isLoading ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Zap className="w-5 h-5 fill-slate-950" />
                                    )}
                                    {editingTrade ? 'DEĞİŞİKLİKLERİ KAYDET' : (mode === 'COVER' ? 'Smart Cover Başlat' : 'Smart Trade Oluştur')}
                                </span>
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                                <button className="py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-800 hover:text-slate-300 transition-all">
                                    TEMİZLE
                                </button>
                                {editingTrade && (
                                    <button 
                                        onClick={onCancelEdit}
                                        className="py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[10px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/10 transition-all"
                                    >
                                        İptal Et
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: TRADE CONTROLS (TP + SL) */}
                <div className="space-y-4">
                    {/* TAKE PROFIT SECTION */}
                    <div className="bg-slate-950/20 p-4 rounded-2xl border border-white/5 relative overflow-hidden group/tp">
                        <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <TrendingUp className="w-48 h-48 text-emerald-500" />
                        </div>
                        
                        <div className="flex items-center justify-between relative z-10 mb-4">
                            <h3 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> {mode === 'COVER' ? 'Geri Alım (TP)' : 'Kar Al'}
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

                        <div className={cn("space-y-4 transition-opacity duration-300 relative z-10", !tpEnabled && "opacity-30 pointer-events-none")}>
                            {/* TP Type Forced to Market */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800/50 rounded-lg shadow-inner">
                                <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Piyasa Emir (Market)</span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hedef Fiyat</span>
                                    <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">
                                        {displayTpPercent >= 0 ? '+' : ''}{displayTpPercent.toFixed(2)}%
                                    </span>
                                </div>

                                {!isSplitTp ? (
                                    <div className="space-y-4 animate-in fade-in zoom-in-95">
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={tpPrice}
                                                onChange={(e) => setTpPrice(e.target.value)}
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-black text-white outline-none focus:border-emerald-500/50 transition-all"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setIsSplitTp(true);
                                                // Sync current tpPrice to target 1
                                                setTpTargets([{ id: '1', price: tpPrice, volume: 100 }]);
                                            }}
                                            className="w-full py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2 group/split"
                                        >
                                            <Split className="w-3.5 h-3.5 text-emerald-400 group-hover/split:rotate-12 transition-transform" />
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hedefleri Böl</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5">
                                            <span>Fiyat</span>
                                            <span>Miktar %</span>
                                        </div>
                                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                                            {tpTargets.map((target) => {
                                                const tP = parseFloat(target.price) || 0;
                                                const tPct = buyP > 0 ? ((tP / buyP) - 1) * 100 : 0;
                                                const dPct = mode === 'COVER' ? -tPct : tPct;
                                                return (
                                                    <div key={target.id} className="grid grid-cols-3 gap-3">
                                                        <input 
                                                            type="text"
                                                            value={target.price}
                                                            onChange={(e) => updateTpTarget(target.id, { price: e.target.value })}
                                                            placeholder="0.0"
                                                            className="bg-slate-900/50 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-cyan-500/50 col-span-2"
                                                        />
                                                        <div className="flex items-center justify-between">
                                                            <span className={cn(
                                                                "text-xs font-black",
                                                                dPct >= 0 ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {dPct.toFixed(2)}%
                                                            </span>
                                                            <button onClick={() => removeTpTarget(target.id)} className="text-slate-600 hover:text-rose-400 transition-colors">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="col-span-3 flex items-center gap-3">
                                                            <input 
                                                                type="range"
                                                                min="1" max="100"
                                                                value={target.volume}
                                                                onChange={(e) => updateTpTarget(target.id, { volume: parseInt(e.target.value) })}
                                                                className="flex-1 accent-emerald-500 h-1 rounded-full"
                                                            />
                                                            <span className="text-[10px] font-black text-white w-8 text-right lowercase">{target.volume}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="pt-2 flex items-center justify-between border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">Toplam:</span>
                                                <span className={cn("text-[10px] font-black", totalTpVolume === 100 ? "text-emerald-400" : "text-rose-400")}>
                                                    {totalTpVolume}%
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={addTpTarget}
                                                    disabled={tpTargets.length >= 8}
                                                    className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-400 uppercase hover:bg-emerald-500/30 disabled:opacity-30"
                                                >
                                                    HEDEF EKLE
                                                </button>
                                                <button 
                                                    onClick={() => setIsSplitTp(false)}
                                                    className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-[9px] font-black text-slate-400 uppercase hover:bg-slate-700"
                                                >
                                                    İPTAL
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

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
                                            <span>Trailing Sapma</span>
                                            <span>{tpDeviation.toFixed(1)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="-20" max="-0.1" step="0.1" 
                                            value={tpDeviation}
                                            onChange={(e) => setTpDeviation(parseFloat(e.target.value))}
                                            className="w-full accent-emerald-500 h-1 rounded-full cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent my-1" />

                    {/* STOP LOSS SECTION */}
                    <div className="bg-slate-950/20 p-4 rounded-2xl border border-white/5 relative overflow-hidden group/sl">
                        <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <ShieldAlert className="w-48 h-48 text-rose-500" />
                        </div>

                        <div className="flex items-center justify-between relative z-10 mb-4">
                            <h3 className="text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" /> {mode === 'COVER' ? 'Yeniden Al (SL)' : 'Stop Loss'}
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

                        <div className={cn("space-y-4 transition-opacity duration-300 relative z-10", !slEnabled && "opacity-30 pointer-events-none")}>
                            {/* SL Type Forced to Market */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800/50 rounded-lg shadow-inner">
                                <Zap className="w-3 h-3 text-rose-500 fill-rose-500/20" />
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Piyasa Emir (Market)</span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stop Seviyesi</span>
                                    <span className="text-[10px] font-black text-rose-400 font-mono tracking-tighter">
                                        {displaySlPercent >= 0 ? '+' : ''}{displaySlPercent.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={slPrice}
                                        onChange={(e) => setSlPrice(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-black text-white outline-none"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                {/* Trailing Stop Loss */}
                                <div className="space-y-3">
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
                                    {trailingSl && (
                                        <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between text-[9px] font-bold text-rose-400 uppercase tracking-tighter">
                                                <span>Trailing Sapma</span>
                                                <span>{trailingSlDev.toFixed(1)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="-20" max="-0.1" step="0.1" 
                                                value={trailingSlDev}
                                                onChange={(e) => setTrailingSlDev(parseFloat(e.target.value))}
                                                className="w-full accent-rose-500 h-1 rounded-full cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Move to Breakeven */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Maliyete Taşı (BE)</span>
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
            </div>
        </HorizonCard>
    );
};
