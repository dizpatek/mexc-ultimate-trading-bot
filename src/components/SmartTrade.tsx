"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    TrendingUp, 
    ShieldAlert, 
    Zap,
    Split,
    ArrowRightLeft,
    Trash2,
    RefreshCw,
    ChevronDown,
    Activity
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
    controlledMode?: 'TRADE' | 'COVER';
    onModeChange?: (m: 'TRADE' | 'COVER') => void;
    editingTrade?: SmartTradeOrder;
    onCancelEdit?: () => void;
    onSaveSuccess?: () => void;
    compact?: boolean;
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
    controlledMode,
    onModeChange,
    editingTrade,
    onCancelEdit,
    onSaveSuccess,
    compact = false,
}) => {
    // 0. External Data
    const { data: holdingsRaw, refetch: refetchHoldings } = useHoldings();
    const holdings = React.useMemo(() => holdingsRaw || [], [holdingsRaw]);

    // 1. Core State — mode supports controlled pattern from parent
    const [_mode, _setMode] = useState<'TRADE' | 'COVER'>('TRADE');
    const mode = controlledMode ?? _mode;
    const setMode = onModeChange ?? _setMode;
    const [useExisting, setUseExisting] = useState(false);
    const [_symbol, _setSymbol] = useState('BTC/USDT');
    const [amount, setAmount] = useState('0');
    const [allocationPercent, setAllocationPercent] = useState(0);
    const [_buyPrice, _setBuyPrice] = useState('0');
    const [buyType] = useState<OrderType>('MARKET');
    const [trailingBuy, setTrailingBuy] = useState(false);
    const [trailingBuyDev, setTrailingBuyDev] = useState(1.0);
    const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
    const buyPriceInputRef = React.useRef<HTMLInputElement>(null);
    const unitsSectionRef = React.useRef<HTMLDivElement>(null);

    // Auto-focus & Scroll logic when editing starts
    useEffect(() => {
        if (editingTrade) {
            const timer = setTimeout(() => {
                // Focus on input WITHOUT browser auto-scroll
                buyPriceInputRef.current?.focus({ preventScroll: true });
                buyPriceInputRef.current?.select();

                // Precision scroll - Positioning Units Section exactly in the center of the screen
                if (unitsSectionRef.current) {
                    unitsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [editingTrade]);

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

    // Selected Holding Info (Handle "BTC", "BTC/USDT", and "BTCUSDT" formats)
    const selectedHolding = holdings.find(h => {
        const hSym = h.symbol.replace('/', '').replace('USDT', '');
        const sSym = symbol.replace('/', '').replace('USDT', '');
        return hSym === sSym;
    });

    const usdtHolding = holdings.find(h => h.symbol === 'USDT' || h.symbol === 'USDC');
    const usdtBalance = usdtHolding?.holding || 0;

    // 2. Take Profit State
    const [internalTpEnabled, setInternalTpEnabled] = useState(false);
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
    const [internalSlEnabled, setInternalSlEnabled] = useState(false);
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
    const [slTimeout, setSlTimeout] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

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
        
        // Calculate logical targets (+1% / -1% for TRADE, -1% / +1% for COVER)
        const isCover = mode === 'COVER';
        const defaultTp = isCover ? currentPrice * 0.99 : currentPrice * 1.01;
        const defaultSl = isCover ? currentPrice * 1.01 : currentPrice * 0.99;
        
        setTpPrice(defaultTp.toFixed(6));
        setSlPrice(defaultSl.toFixed(6));
        
        // Reset amount and allocation when switching assets
        setAmount('0');
        setAllocationPercent(0);
    }, [setSymbol, setBuyPrice, setTpPrice, setSlPrice, mode]);

    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Auto-clear status message
    useEffect(() => {
        if (statusMsg) {
            const timer = setTimeout(() => setStatusMsg(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMsg]);

    // Sync buyPrice with marketPrice if we're using existing assets (or if buyPrice is empty)
    const [priceSync, setPriceSync] = useState(true);

    // COMPACT MODE: Fetch market price independently since SmartChart is not rendered
    useEffect(() => {
        if (!compact) return; // SmartChart handles this in non-compact mode
        
        const pair = symbol.replace('/', '').toUpperCase();
        let cancelled = false;
        
        const fetchPrice = async () => {
            try {
                const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${pair}`);
                if (res.ok && !cancelled) {
                    const data = await res.json();
                    const p = parseFloat(data.price);
                    if (!isNaN(p) && p > 0) {
                        setMarketPrice(p);
                    }
                }
            } catch {
                // Silently fail - will retry on next interval
            }
        };

        fetchPrice(); // Immediate fetch
        const interval = setInterval(fetchPrice, 15000); // Reduced from 5s to 15s to save Vercel usage limits

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [compact, symbol]);

    useEffect(() => {
        // When priceSync is active, not using existing assets, AND trailingBuy is OFF, always sync with market price
        if (marketPrice !== null && marketPrice > 0 && !editingTrade && priceSync && !useExisting && !trailingBuy) {
            setBuyPrice(marketPrice.toString());
        }
    }, [marketPrice, setBuyPrice, editingTrade, priceSync, useExisting, trailingBuy]);


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
    }, [editingTrade, setMode, setSymbol, setBuyPrice, setTpEnabled, setTpPrice, setSlEnabled, setSlPrice]);

    const handleSubmit = async () => {
        // VALIDATION GATE: Prevent absurd trades
        const submitAmt = parseFloat(amount);
        
        if (isNaN(submitAmt) || submitAmt <= 0) {
            setStatusMsg({ text: 'Hata: Miktar 0 veya geçersiz. Lütfen bir miktar girin.', type: 'error' });
            return;
        }
        
        // If priceSync is active, use marketPrice for the order
        const effectiveBuyPrice = (priceSync && !useExisting && marketPrice) 
            ? marketPrice.toString() 
            : buyPrice;
        const effectiveBuyP = parseFloat(effectiveBuyPrice);
        
        if (isNaN(effectiveBuyP) || effectiveBuyP <= 0) {
            setStatusMsg({ text: 'Hata: Alış fiyatı geçersiz. Fiyat yüklenmesini bekleyin.', type: 'error' });
            return;
        }
        
        // Use effective price for validation
        const priceForValidation = Math.max(effectiveBuyP, marketPrice || 0);
        const totalCost = submitAmt * priceForValidation;
        
        // Sanity check: max $100K per trade in test mode
        const MAX_TEST_ORDER_USDT = 100_000;
        if (totalCost > MAX_TEST_ORDER_USDT) {
            setStatusMsg({ text: `Hata: Maks $${MAX_TEST_ORDER_USDT.toLocaleString()} işlem limiti. Hesaplanan: $${totalCost.toFixed(2)}. Miktarı azaltın.`, type: 'error' });
            return;
        }
        
        // Check USDT balance for new purchases
        if (!editingTrade && !useExisting && mode === 'TRADE' && totalCost > (usdtBalance + 0.01)) {
            setStatusMsg({ text: `Hata: Yetersiz USDT bakiyesi. Gerekli: $${totalCost.toFixed(2)}, Mevcut: $${usdtBalance.toFixed(2)}`, type: 'error' });
            return;
        }

        // Check Asset balance for COVER mode using existing
        if (!editingTrade && useExisting && mode === 'COVER') {
            const holding = holdings.find(h => {
                const hSym = h.symbol.replace('/', '').replace('USDT', '');
                const sSym = symbol.replace('/', '').replace('USDT', '');
                return hSym === sSym;
            });

            if (holding) {
                if (submitAmt > (holding.holding + 0.00000001)) {
                    setStatusMsg({ text: `Hata: Yetersiz ${holding.symbol} bakiyesi. Gerekli: ${submitAmt}, Mevcut: ${holding.holding}`, type: 'error' });
                    return;
                }
            } else {
                 setStatusMsg({ text: `Hata: Portföyde ${symbol.split('/')[0].split('USDT')[0]} bulunamadı.`, type: 'error' });
                 return;
            }
        }
        
        setIsLoading(true);
        try {
            const payload = {
                mode, // 'TRADE' | 'COVER'
                symbol,
                amount,
                buyPrice: effectiveBuyPrice,
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
                    breakeven: moveToBreakeven,
                    timeout: slTimeout,
                    timeoutSeconds: slTimeout ? 10 : undefined
                } : null
            };
            
            if (editingTrade) {
                await api.put(`/trade/smart?id=${editingTrade.id}`, payload);
                setStatusMsg({ text: 'Değişiklikler başarıyla kaydedildi!', type: 'success' });
                
                // Geri dönmeden önce mesajın görünmesi için kısa bir bekleme
                setTimeout(() => {
                    if (onCancelEdit) onCancelEdit();
                    if (onSaveSuccess) onSaveSuccess();
                }, 1500);
            } else {
                await createSmartTrade(payload as Record<string, unknown>);
                setStatusMsg({ text: 'SmartTrade başarıyla oluşturuldu!', type: 'success' });
                
                // Yeni işlem sonrası listeye odaklan
                setTimeout(() => {
                    if (onSaveSuccess) onSaveSuccess();
                    // Mesajı temizle
                    setStatusMsg(null);
                }, 2000);
            }
            refetchHoldings(); // Refresh portfolio immediately
        } catch (error: unknown) {
            console.error('SmartTrade submission failed:', error);
            // Extract detailed error message from backend
            let errorDetail = 'Bilinmeyen hata';
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { 
                    response?: { 
                        data?: { 
                            message?: string; 
                            error?: string; 
                            details?: string | { message?: string; error?: string }
                        } 
                    } 
                };
                const data = axiosError.response?.data;
                console.log('Full Backend Error Data:', data);
                errorDetail = data?.message || data?.error || (typeof data?.details === 'string' ? data.details : data?.details?.message) || 'Backend hatası';
            } else if (error instanceof Error) {
                errorDetail = error.message;
            }
            setStatusMsg({ text: `Hata: ${errorDetail}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };





    const handlePricesChange = useCallback((p: { buy?: number; tp?: number; sl?: number }) => {
        if (p.buy !== undefined && p.tp === undefined && p.sl === undefined) {
             const newBuy = p.buy;
             const oldBuy = parseFloat(buyPrice) || 0;
             setBuyPrice(newBuy.toString());
             
             // If ONLY buy was moved (dragged individually or auto-tracking), move TP and SL proportionally
             if (oldBuy > 0) {
                 const currentTpP = parseFloat(tpPrice) || 0;
                 const currentSlP = parseFloat(slPrice) || 0;
                 
                 if (currentTpP > 0) {
                     const newTp = newBuy * (currentTpP / oldBuy);
                     setTpPrice(Number(newTp.toFixed(6)).toString());
                 }
                 
                 // Scale split TP targets if any, regardless of whether main TP is set
                 setTpTargets(prev => prev.map(t => {
                     const tPrice = parseFloat(t.price) || 0;
                     if (tPrice > 0) {
                         const scaledPrice = newBuy * (tPrice / oldBuy);
                         return { ...t, price: Number(scaledPrice.toFixed(6)).toString() };
                     }
                     return t;
                 }));

                 if (currentSlP > 0) {
                     const newSl = newBuy * (currentSlP / oldBuy);
                     setSlPrice(Number(newSl.toFixed(6)).toString());
                 }
             }
        } else {
            if (p.buy !== undefined) setBuyPrice(p.buy.toString());
            if (p.tp !== undefined) setTpPrice(p.tp.toString());
            if (p.sl !== undefined) setSlPrice(p.sl.toString());
        }
    }, [buyPrice, tpPrice, slPrice, setBuyPrice, setTpPrice, setSlPrice, setTpTargets]);

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

    // Use effective price for display when priceSync is active
    const displayBuyP = (priceSync && !useExisting && marketPrice) ? marketPrice : buyP;
    
    const profitUsdt = mode === 'COVER' ? amt * (buyP - tpP) : amt * (tpP - buyP);
    const riskUsdt = mode === 'COVER' ? amt * (slP - buyP) : amt * (buyP - slP);
    const riskReward = riskUsdt > 0 ? (profitUsdt / riskUsdt).toFixed(1) : '∞';
    const computedTotal = (amt * displayBuyP).toFixed(2);

    // --- VISUALIZATION LOGIC FOR CHART ---
    // If Trailing Buy is active and price is better than trigger, 
    // we visualize the potential Entry/TP/SL moving with the market price.
    const vizBuyPrice = buyP;
    const vizTpPrice = tpP;
    const vizSlPrice = slP;

    // Reciprocal TP/SL price adjustment when mode changes
    // Only swaps if current targets are 'illogical' for the selected mode
    const lastSwappedModeRef = useRef<string | null>(null);
    useEffect(() => {
        // Skip if we're in edit mode (don't override existing trades' targets)
        if (editingTrade || !hasInitialized || buyP <= 0 || tpP <= 0 || slP <= 0) return;
        
        // Prevent infinite loop: only swap once per mode change
        if (lastSwappedModeRef.current === mode) return;
        
        const currentTpPercent = ((tpP / buyP) - 1) * 100;
        
        // Logical check: Trade TP should be above entry (>0), Cover TP should be below entry (<0)
        const isTradeAndTpLow = (mode === 'TRADE' && currentTpPercent < 0);
        const isCoverAndTpHigh = (mode === 'COVER' && currentTpPercent > 0);
        
        if (isTradeAndTpLow || isCoverAndTpHigh) {
            lastSwappedModeRef.current = mode;
            // Reciprocal swap
            const oldTp = tpPrice;
            const oldSl = slPrice;
            setTpPrice(oldSl);
            setSlPrice(oldTp);
        }
    }, [mode, buyP, tpP, slP, tpPrice, slPrice, setTpPrice, setSlPrice, editingTrade, hasInitialized]);

    // Removed active simulation block that caused TP, SL, and Potential Entry lines to jitter/snap towards market price when trailing was active.

    return (
        <div id="trade-top-anchor">
            <HorizonCard className={cn(
                "bg-[#020617]/40 backdrop-blur-xl border-slate-800/50 shadow-2xl overflow-hidden group/smart",
                compact ? "p-2 border-0 shadow-none bg-transparent" : "p-4"
            )} glowColor={mode === 'COVER' ? "emerald" : "cyan"}>
            
            {(editingTrade || onCancelEdit) && !compact && (
                <div className="mb-1 p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                        <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                            {editingTrade ? `İŞLEM DÜZENLEME MODU: ${editingTrade.symbol} (ID: ${editingTrade.id})` : 'SmartTrade'}
                        </span>
                    </div>
                    {onCancelEdit && (
                        <button 
                            onClick={onCancelEdit}
                            className="text-xs font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest px-4 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 transition-all"
                        >
                            {editingTrade ? 'İPTAL ET' : 'TERMİNALİ KAPAT'}
                        </button>
                    )}
                </div>
            )}
            
            {/* Integrated SmartChart Section (Shown by default in full mode) */}
             {!compact && (
                <div className={cn("mb-1 transition-all duration-500 overflow-hidden", compact ? "h-[260px] opacity-100" : "h-auto opacity-100")}>
                    <SmartChart 
                        compact={compact}
                        symbol={symbol}
                        buyPrice={buyP}
                        tpPrice={vizTpPrice}
                        slPrice={vizSlPrice}
                        onPricesChange={handlePricesChange}
                        tpEnabled={tpEnabled}
                        slEnabled={slEnabled}
                        trailingBuy={trailingBuy}
                        onTrailingBuyChange={setTrailingBuy}
                        trailingSl={trailingSl}
                        onTrailingSlChange={setTrailingSl}
                        trailingTp={trailingTp}
                        onTrailingTpChange={setTrailingTp}
                        currentMarketPrice={marketPrice || selectedHolding?.price}
                        onMarketPriceUpdate={setMarketPrice}
                        mode={mode}
                        assets={filteredAssets}
                        onAssetChange={handleAssetSelect}
                        potentialEntry={trailingBuy ? vizBuyPrice : undefined}
                        isEditingExisting={!!editingTrade}
                    />
                </div>
             )}

             {/* Compact Mode Top Section - Hidden when editing */}
              {compact && !editingTrade && (
                 <div id="compact-top-anchor" className="flex flex-col gap-1.5 mb-2 relative z-50">
                     {/* Mode Switcher at the very top */}
                     <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/50 backdrop-blur-md w-full">
                         <button 
                             onClick={() => {
                                 setMode('TRADE');
                                 setUseExisting(false);
                             }}
                             className={cn(
                                 "flex-1 flex items-center justify-center gap-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all px-2 py-0.5",
                                 mode === 'TRADE' 
                                     ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                                     : "text-slate-500 hover:text-slate-300"
                             )}
                             title="Mod: Trade - Düşükten al, yüksekten sat"
                             aria-label="Trade Modu"
                         >
                             <Zap className={cn("w-2.5 h-2.5", mode === 'TRADE' ? "fill-slate-950/20" : "")} />
                             Trade
                         </button>
                         <button 
                             onClick={() => {
                                 setMode('COVER');
                                 setUseExisting(true);
                             }}
                             className={cn(
                                 "flex-1 flex items-center justify-center gap-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all px-2 py-0.5",
                                 mode === 'COVER' 
                                     ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                     : "text-slate-500 hover:text-slate-300"
                             )}
                             title="Mod: Cover - Varlık biriktirme ve risk yönetimi"
                             aria-label="Cover Modu"
                         >
                             <ArrowRightLeft className="w-2.5 h-2.5" />
                             Cover
                         </button>
                     </div>

                     {/* Asset Selector */}
                     <div className="relative">
                         <button
                             type="button"
                             onClick={() => setAssetDropdownOpen(!assetDropdownOpen)}
                             className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-0.5 text-[10px] font-black text-white outline-none focus:border-cyan-500/50 flex flex-row items-center justify-between shadow-inner transition-colors hover:bg-slate-900/80"
                             title="İşlem yapılacak varlığı seçin"
                             aria-label="Varlık Seçici"
                         >
                             <div className="flex items-center gap-2">
                                 {selectedHolding?.symbol ? (
                                     <>
                                         <AssetIcon symbol={selectedHolding.symbol} size={12} />
                                         <span className="text-[10px]">{selectedHolding.symbol}</span>
                                     </>
                                 ) : (
                                     <span className="text-slate-500 text-[10px]">Varlık Seçin</span>
                                 )}
                             </div>
                             <div className="flex items-center gap-2">
                                 <span className="text-[7px] text-cyan-500 font-bold uppercase tracking-tighter">Değiştir</span>
                                 <ChevronDown className={cn("w-2.5 h-2.5 text-slate-500 transition-transform", assetDropdownOpen && "rotate-180")} />
                             </div>
                         </button>
                         
                         {assetDropdownOpen && (
                             <>
                                 <div 
                                     className="fixed inset-0 z-40" 
                                     onClick={() => setAssetDropdownOpen(false)} 
                                 />
                                 <div className="absolute top-[calc(100%+2px)] left-0 w-full bg-[#020617] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 focus:outline-none ring-1 ring-cyan-500/20">
                                     <div className="max-h-40 overflow-y-auto custom-scrollbar py-0.5">
                                         {filteredAssets.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC').length === 0 && (
                                             <div className="px-3 py-3 text-center text-[10px] text-slate-500">
                                                 Kullanılabilir varlık bulunamadı.
                                             </div>
                                         )}
                                         {filteredAssets.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC').map(asset => (
                                             <button
                                                 key={asset.symbol}
                                                 type="button"
                                                 onClick={() => {
                                                     handleAssetSelect(asset);
                                                     setAssetDropdownOpen(false);
                                                 }}
                                                 className={cn(
                                                     "w-full flex items-center justify-between px-2.5 py-2 hover:bg-white/5 transition-colors text-left",
                                                     selectedHolding?.symbol === asset.symbol ? "bg-cyan-500/10" : ""
                                                 )}
                                             >
                                                 <div className="flex items-center gap-2 px-1">
                                                     <AssetIcon symbol={asset.symbol} size={16} />
                                                     <span className={cn(
                                                         "text-[11px] font-black transition-colors",
                                                         selectedHolding?.symbol === asset.symbol ? "text-cyan-400" : "text-white"
                                                     )}>
                                                         {asset.symbol}
                                                     </span>
                                                 </div>
                                                 <span className="text-[9px] font-bold text-slate-500 font-mono">
                                                     {asset.holding.toFixed(4)}
                                                 </span>
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             </>
                         )}
                     </div>
                 </div>
             )}

             {/* Main Grid: 3 Columns or Flex Column if Compact - Hidden when editing */}
              {!editingTrade && (<div id="smart-trade-controls" className={cn("gap-5 mt-2", compact ? "flex flex-col gap-1.5" : "grid grid-cols-1 lg:grid-cols-3")}>
                 
                 {/* COLUMN 1: UNITS & BUY PRICE */}
                 <div className={cn("flex flex-col gap-4")}>
                     {/* Units Section */}
                     <div 
                        id="units-section" 
                        ref={unitsSectionRef}
                        className={cn("bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col", compact ? "gap-1 p-0 bg-transparent border-0" : "p-5 gap-4 shadow-lg relative overflow-hidden")}
                      >
                         {!compact && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 opacity-50"></div>}

                         {/* Header with MAX selection */}
                        <div className="flex items-center justify-between">
                            <h3 className={cn("font-black text-slate-400 uppercase tracking-widest flex items-center gap-2", compact ? "text-[10px]" : "text-xs")}>
                                {mode === 'COVER' ? 'Satış Miktarı' : 'Birimler'}
                            </h3>
                            <div className="flex items-center gap-2">
                                {compact && (
                                    <button 
                                        onClick={() => {
                                            const RESERVE_FACTOR = 0.975; // 2.5% buffer for fees/slippage
                                            if (useExisting && selectedHolding) {
                                                const safeQty = selectedHolding.holding * RESERVE_FACTOR;
                                                setAmount(safeQty.toFixed(6));
                                                setAllocationPercent(100);
                                            } else if (!useExisting && usdtBalance > 0) {
                                                setAllocationPercent(100);
                                                const buyP = parseFloat(buyPrice) || 0;
                                                if (buyP > 0) setAmount(((usdtBalance * RESERVE_FACTOR) / buyP).toFixed(6));
                                            }

                                        }}
                                        className="text-[9px] font-black text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded bg-cyan-500/5 hover:bg-cyan-500/20 transition-all"
                                        title="Mevcut bakiyenin tamamını kullan"
                                        aria-label="Maksimum Miktar"
                                    >
                                        MAX
                                    </button>
                                )}
                                <div className={cn("flex items-center ml-2", compact ? "gap-1.5" : "gap-3")}>
                                    <span className={cn("font-bold text-slate-500 uppercase", compact ? "text-[9px]" : "text-xs")}>Varlıkları Kullan</span>
                                    <button 
                                        onClick={() => setUseExisting(!useExisting)}
                                        className={cn(
                                            "rounded-full transition-all relative px-0.5",
                                            compact ? "w-6 h-3.5" : "w-10 h-5 px-1",
                                            useExisting ? "bg-cyan-500" : "bg-slate-700"
                                        )}
                                        title={useExisting ? "Mevcut portföydeki varlıkları kullan" : "Cüzdandaki USDT ile yeni alım yap"}
                                        aria-label="Varlıkları Kullan Switçh"
                                    >
                                        <div className={cn(
                                            "bg-white rounded-full transition-all",
                                            compact ? "w-2.5 h-2.5" : "w-3 h-3",
                                            useExisting ? (compact ? "translate-x-2.5" : "translate-x-5") : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>
                        </div>



                        {/* Amount Input with MAX Button */}
                        <div className="relative">
                            <input 
                                type="text" 
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value);
                                    if (useExisting && selectedHolding && parseFloat(e.target.value) > 0) {
                                        const pct = (parseFloat(e.target.value) / selectedHolding.holding) * 100;
                                        setAllocationPercent(Math.min(100, pct));
                                    }
                                }}
                                className={cn("w-full bg-slate-950/50 border border-slate-800 rounded-lg px-2 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all shadow-inner", compact ? "h-8 py-0 pr-12" : "py-3 pr-24")}
                            />
                            <div className={cn("absolute top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-tighter", compact ? "right-2" : "right-14")}>{symbol.split('/')[0]}</div>
                            {!compact && useExisting && selectedHolding && (
                                <button
                                    onClick={() => {
                                        const safeQty = selectedHolding.holding * 0.975; // Reserve for fees
                                        setAmount(safeQty.toFixed(6));
                                        setAllocationPercent(100);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-xs font-black text-cyan-400 uppercase hover:bg-cyan-500/30 transition-all"
                                >
                                    MAX
                                </button>
                            )}
                        </div>

                        {/* MINI AMOUNT SLIDER (ALWAYS VISIBLE IN COMPACT) */}
                        {compact && (
                            <div className="flex items-center gap-2 px-1">
                                <span className="text-[8px] font-bold text-slate-600 uppercase">Ratio</span>
                                <input 
                                    type="range" 
                                    min="0" max="100" step="1" 
                                    value={allocationPercent}
                                    onChange={(e) => {
                                        const pct = parseFloat(e.target.value);
                                        setAllocationPercent(pct);
                                        const RESERVE = pct === 100 ? 0.975 : 1.0; 
                                        if (useExisting && selectedHolding) {
                                            setAmount(((selectedHolding.holding * RESERVE * pct) / 100).toFixed(6));
                                        } else if (!useExisting && usdtBalance > 0) {
                                            const buyP = parseFloat(buyPrice) || 0;
                                            if (buyP > 0) setAmount(((((usdtBalance * RESERVE * pct) / 100) / buyP)).toFixed(6));
                                        }

                                    }}
                                    className="flex-1 h-1 accent-cyan-500/70 cursor-pointer"
                                />
                                <span className="text-[9px] font-black text-cyan-500/80 font-mono w-6 text-right">{allocationPercent === 100 ? '97.5%' : `${allocationPercent.toFixed(0)}%`}</span>
                            </div>
                        )}

                        {/* Percentage Slider (Ratio) - Hidden in compact as mini slider is used */}
                        {!compact && ((useExisting && selectedHolding) || (!useExisting && usdtBalance > 0)) && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                                    <span>{useExisting ? 'Varlık Oranı' : 'USDT Kullanımı'}</span>
                                    <span className="text-cyan-400">{allocationPercent === 100 ? '97.5% (Safe Max)' : `${allocationPercent.toFixed(0)}%`}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="1" 
                                    value={allocationPercent}
                                    onChange={(e) => {
                                        const pct = parseFloat(e.target.value);
                                        setAllocationPercent(pct);
                                        const RESERVE = pct === 100 ? 0.975 : 1.0; 
                                        
                                        if (useExisting && selectedHolding) {
                                            const calculatedAmount = (selectedHolding.holding * RESERVE * pct) / 100;
                                            setAmount(calculatedAmount.toFixed(6));
                                        } else if (!useExisting && usdtBalance > 0) {
                                            const buyP = parseFloat(buyPrice) || 0;
                                            if (buyP > 0) {
                                                const calculatedAmount = ((usdtBalance * RESERVE * pct) / 100) / buyP;
                                                setAmount(calculatedAmount.toFixed(6));
                                            }
                                        }
                                    }}
                                    className="w-full accent-cyan-500 h-2 rounded-full cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                    <span>0%</span>
                                    <span>25%</span>
                                    <span>50%</span>
                                    <span>75%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        )}

                        {/* Total Section Moved Here */}
                        <div className={cn("animate-in fade-in slide-in-from-top-4", compact ? "space-y-1 pt-1 mt-1 border-t border-white/5" : "space-y-3 pt-4 mt-2 border-t border-white/5")}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Toplam</h3>
                            </div>
                             <div className="relative">
                                <input 
                                    type="text" 
                                    value={computedTotal}
                                    readOnly
                                    className={cn("w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 text-sm font-black text-white outline-none cursor-default font-mono shadow-inner text-emerald-400", compact ? "h-8 py-0" : "py-3")}
                                />
                                <div className={cn("absolute top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500 uppercase tracking-widest", compact ? "right-2" : "right-4")}>USDT</div>
                            </div>
                        </div>
                    </div>

                    {/* Buy Price & Trailing Section (NOW ALWAYS VISIBLE) */}
                    <div className={cn("bg-slate-950/40 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2", compact ? "space-y-1 bg-transparent border-0 p-0" : "space-y-4 p-5 shadow-lg relative")}>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 shrink-0">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-7">
                                    {mode === 'TRADE' ? 'TBY' : 'TSY'}
                                </h3>
                                {!useExisting && (
                                    <button 
                                        onClick={() => setTrailingBuy(!trailingBuy)}
                                        className={cn(
                                            "w-8 h-4 rounded-full transition-all relative px-0.5 border border-white/10",
                                            trailingBuy ? (mode === 'TRADE' ? "bg-cyan-500" : "bg-emerald-500") : "bg-slate-700/50 hover:bg-slate-600"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                            trailingBuy ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </button>
                                )}
                            </div>

                            {!useExisting && trailingBuy && (
                                <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                                    <div className="flex flex-col items-end -space-y-1 pr-1">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter opacity-60">Sapma</span>
                                        <span className={cn("text-[9px] font-black font-mono leading-none", mode === 'TRADE' ? "text-cyan-400" : "text-emerald-400")}>{trailingBuyDev.toFixed(1)}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0.1" max="9.9" step="0.1" 
                                        value={trailingBuyDev}
                                        onChange={(e) => setTrailingBuyDev(parseFloat(e.target.value))}
                                        className={cn("w-32 h-1 rounded-full cursor-pointer transition-all bg-slate-800/50 appearance-none", mode === 'TRADE' ? "accent-cyan-400" : "accent-emerald-400")}
                                    />
                                </div>
                            )}
                        </div>

                        {!useExisting && priceSync && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in">
                                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin-slow" />
                                <span className="text-[9px] font-black text-emerald-400 uppercase">Anlık Fiyat</span>
                                <button 
                                    onClick={() => setPriceSync(false)}
                                    className="ml-auto text-[8px] font-bold text-slate-500 hover:text-white uppercase"
                                >
                                    Değiştir
                                </button>
                            </div>
                        )}

                        {(!priceSync || useExisting) && (
                        <div className="relative">
                            <input 
                                type="text" 
                                value={buyPrice} 
                                readOnly={useExisting}
                                onChange={(e) => {
                                    setBuyPrice(e.target.value);
                                    if (priceSync) setPriceSync(false); // User manual override
                                }}
                                id="buy-price-input"
                                ref={buyPriceInputRef}
                                className={cn(
                                    "w-full bg-slate-950/50 border border-slate-800 rounded-lg px-2 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all shadow-inner font-mono",
                                    compact ? "h-8 py-0 pr-12" : "py-3 pr-24",
                                    useExisting && "opacity-50 cursor-not-allowed bg-slate-900/20"
                                )}
                            />
                            <div className={cn("absolute top-1/2 -translate-y-1/2 flex items-center gap-1", compact ? "right-2" : "right-4")}>
                                <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">USDT</div>
                            </div>
                        </div>
                        )}
                        
                    </div>
                </div>

                {/* COLUMN 2: SUMMARY & ACTIONS */}
                <div className={cn("flex flex-col h-full", compact ? "gap-1.5" : "gap-5")}>

                    {/* MOVED MODE SWITCHER HERE */}
                    {!compact && (
                        <div className="flex flex-col items-center gap-1.5 w-full animate-in fade-in slide-in-from-top-4 relative z-20">
                            <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800/80 backdrop-blur-md w-full shadow-xl">
                                <button 
                                    onClick={() => {
                                        setMode('TRADE');
                                        setUseExisting(false);
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all px-4 py-3",
                                        mode === 'TRADE' 
                                            ? "bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-[1.02]" 
                                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                    )}
                                >
                                    <Zap className={cn("w-4 h-4", mode === 'TRADE' ? "fill-slate-950/20" : "")} />
                                    Trade
                                </button>
                                <button 
                                    onClick={() => {
                                        setMode('COVER');
                                        setUseExisting(true);
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all px-4 py-3",
                                        mode === 'COVER' 
                                            ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-[1.02]" 
                                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                    )}
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Cover
                                </button>
                            </div>
                            <div className="text-center h-4 mt-0.5">
                                {mode === 'TRADE' ? (
                                    <span className="text-[9px] font-black text-cyan-400/60 uppercase tracking-[0.1em]">
                                        Düşükten alıp yüksekten satarak kâr et.
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-black text-emerald-400/60 uppercase tracking-[0.1em]">
                                        Yüksekten satıp alttan alarak adet artır.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={cn(
                        "rounded-2xl animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden group/summary flex-1 flex flex-col justify-center",
                        compact ? "bg-transparent p-0 space-y-2 shadow-none border-t border-white/5 pt-2" : "p-8 space-y-8 shadow-2xl bg-cyan-950/10 border border-cyan-500/10"
                    )}>
                        {!compact && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-8 opacity-[0.02] pointer-events-none group-hover/summary:opacity-[0.04] transition-opacity scale-150">
                                <Zap className="w-64 h-64 text-cyan-500" />
                            </div>
                        )}

                        <div className={cn("flex flex-col relative z-10 w-full", compact ? "gap-1" : "gap-6")}>
                            <div className={cn("flex flex-col items-center justify-center relative border-white/10", compact ? "pb-1" : "border-b pb-4")}>
                                <h3 className={cn("font-black text-cyan-500/80 uppercase tracking-[0.2em] flex items-center justify-center gap-2 w-full text-center", compact ? "text-[9px]" : "text-sm")}>
                                    <Activity className="w-4 h-4" /> {mode === 'COVER' ? 'VARLIK BİRİKTİRME' : 'NİHAİ SONUÇ'}
                                </h3>
                                {statusMsg && (
                                    <div className={cn(
                                        "absolute -top-3 w-full text-center px-3 py-1 rounded border text-[10px] font-black uppercase animate-in fade-in slide-in-from-top-2 duration-300 z-30 shadow-lg",
                                        statusMsg.type === 'success' ? "bg-emerald-500/90 text-white border-emerald-500" : "bg-rose-500/90 text-white border-rose-500"
                                    )}>
                                        {statusMsg.text}
                                    </div>
                                )}
                            </div>
                            
                            {compact ? (
                                <div className="flex flex-col gap-0.5 border-t border-white/5 pt-1 mt-1">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tighter">Tahmini Kar</span>
                                        <span className="text-[10px] font-black text-emerald-400 font-mono">
                                            ${profitUsdt.toFixed(2)} ({profitUsdt >= 0 ? '+' : ''}{tpPercent.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tighter">Max Risk</span>
                                        <span className="text-[10px] font-black text-rose-400 font-mono">
                                            -${riskUsdt.toFixed(2)} ({slPercent.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-tighter">Risk/Ödül</span>
                                        <span className="text-[10px] font-black text-white font-mono">1:{riskReward}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 w-full">
                                    <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-between p-5 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                                        <div className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest whitespace-nowrap">
                                            {mode === 'COVER' ? 'TAHMİNİ KAZANÇ' : 'HESAPLANAN KAR'}
                                        </div>
                                        <div className="font-black text-emerald-400 font-mono text-2xl tracking-tighter shadow-emerald-400/20 drop-shadow-md">
                                            +${profitUsdt.toFixed(2)}
                                        </div>
                                    </div>
                                    
                                    <div className="rounded-xl bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20 flex items-center justify-between p-5 shadow-[0_0_15px_rgba(244,63,94,0.05)]">
                                        <div className="text-[10px] font-black text-rose-500/80 uppercase tracking-widest whitespace-nowrap">
                                            {mode === 'COVER' ? 'TAHMİNİ KAYIP' : 'MAKSİMUM RİSK'}
                                        </div>
                                        <div className="font-black text-rose-400 font-mono text-xl tracking-tighter shadow-rose-400/20 drop-shadow-md">
                                            -${riskUsdt.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="rounded-xl flex items-center justify-center transition-all bg-slate-900/60 border border-white/5 p-4 mt-2 gap-4">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">RİSK / ÖDÜL ORANI</div>
                                        <div className="h-4 w-[1px] bg-white/10" />
                                        <div className="font-black text-white font-mono text-xl tracking-tighter">1 : {riskReward}</div>
                                    </div>
                                </div>
                            )}
                        </div>


                    </div>
                </div>

                {/* COLUMN 3: TRADE CONTROLS (TP + SL) */}
                <div className={cn("flex flex-col", compact ? "gap-1" : "gap-4")}>
                    {/* TP/SL TOGGLE ROW (COMPACT) */}
                    {compact && !editingTrade && (
                        <div className="flex items-center gap-1 border-t border-white/5 pt-2 pb-1.5 relative px-0.5">
                            {/* Advanced Settings Toggle Button */}
                            <button 
                                onClick={() => {
                                    const nextState = !showAdvanced;
                                    setShowAdvanced(nextState);
                                    if (nextState && !tpEnabled && !slEnabled) {
                                        setTpEnabled(true);
                                        setSlEnabled(true);
                                        
                                        // Calculate default +10% TP and -5% SL based on effective buy price
                                        const currentP = parseFloat(buyPrice) || 0;
                                        if (currentP > 0) {
                                            const isCover = mode === 'COVER';
                                            const defaultTp = isCover ? currentP * 0.90 : currentP * 1.10; // +10% / -10% target
                                            const defaultSl = isCover ? currentP * 1.05 : currentP * 0.95; // -5% / +5% risk
                                            
                                            setTpPrice(defaultTp.toFixed(4));
                                            setSlPrice(defaultSl.toFixed(4));
                                        }
                                    }
                                }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all border",
                                    showAdvanced 
                                        ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" 
                                        : "bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
                                )}
                            >
                                <Zap className="w-3 h-3" />
                                {showAdvanced ? 'TP/SL Açık' : 'TP/SL Ekle'}
                            </button>
                        </div>
                    )}

                    {/* TP/SL Toggles - Only visible when showAdvanced is true */}
                    {compact && showAdvanced && !editingTrade && (
                        <div className="flex items-center gap-1">
                            <div className={cn(
                                "flex-1 flex items-center justify-between border rounded-md px-2 py-1.5 transition-all duration-300",
                                tpEnabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900/40 border-white/5 opacity-60"
                            )}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <TrendingUp className={cn("w-3 h-3 flex-shrink-0", tpEnabled ? "text-emerald-400" : "text-slate-500")} />
                                    <span className={cn("text-[9px] font-black uppercase tracking-tighter truncate", tpEnabled ? "text-emerald-400" : "text-slate-500")}>
                                        TAKE PROFIT
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setTpEnabled(!tpEnabled)}
                                    className={cn(
                                        "w-6 h-3.5 rounded-full transition-all relative px-0.5 flex-shrink-0",
                                        tpEnabled ? "bg-emerald-500" : "bg-slate-800"
                                    )}
                                >
                                    <div className={cn(
                                        "w-2.5 h-2.5 bg-white rounded-full transition-all",
                                        tpEnabled ? "translate-x-2.5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>

                            {/* Stop Loss Toggle Box */}
                            <div className={cn(
                                "flex-1 flex items-center justify-between border rounded-md px-2 py-1.5 transition-all duration-300",
                                slEnabled ? "bg-rose-500/10 border-rose-500/30" : "bg-slate-900/40 border-white/5 opacity-60"
                            )}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <ShieldAlert className={cn("w-3 h-3 flex-shrink-0", slEnabled ? "text-rose-400" : "text-slate-500")} />
                                    <span className={cn("text-[9px] font-black uppercase tracking-tighter truncate", slEnabled ? "text-rose-400" : "text-slate-500")}>
                                        STOP LOSS
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setSlEnabled(!slEnabled)}
                                    className={cn(
                                        "w-6 h-3.5 rounded-full transition-all relative px-0.5 flex-shrink-0",
                                        slEnabled ? "bg-rose-500" : "bg-slate-800"
                                    )}
                                >
                                    <div className={cn(
                                        "w-2.5 h-2.5 bg-white rounded-full transition-all",
                                        slEnabled ? "translate-x-2.5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Compact Mode SmartChart - Contextual Placement under TP/SL Toggles */}
                    {compact && showAdvanced && !editingTrade && (
                        <div 
                            className="animate-in fade-in slide-in-from-top-2 duration-500 overflow-hidden border border-white/5 rounded-xl mb-1 mt-0.5 z-[40] relative w-full"
                            style={{ height: 'clamp(200px, 40vh, 280px)' }}
                            ref={(el) => {
                                if (el) {
                                    setTimeout(() => {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 300);
                                }
                            }}
                        >
                            <SmartChart 
                                compact={true}
                                symbol={symbol}
                                buyPrice={buyP}
                                tpPrice={vizTpPrice}
                                slPrice={vizSlPrice}
                                onPricesChange={handlePricesChange}
                                tpEnabled={tpEnabled}
                                slEnabled={slEnabled}
                                trailingBuy={trailingBuy}
                                onTrailingBuyChange={setTrailingBuy}
                                trailingSl={trailingSl}
                                onTrailingSlChange={setTrailingSl}
                                trailingTp={trailingTp}
                                onTrailingTpChange={setTrailingTp}
                                currentMarketPrice={marketPrice || selectedHolding?.price}
                                onMarketPriceUpdate={setMarketPrice}
                                mode={mode}
                                assets={filteredAssets}
                                onAssetChange={handleAssetSelect}
                                potentialEntry={trailingBuy ? vizBuyPrice : undefined}
                            />
                        </div>
                    )}

                    {/* TAKE PROFIT CONFIGURATION PANEL */}
                    {((tpEnabled && showAdvanced) || !compact) && (
                        <div className={cn(
                            "relative overflow-hidden group/tp transition-all duration-300",
                            compact ? "p-0 bg-transparent mb-1" : "bg-slate-950/20 p-4 rounded-2xl border border-white/5",
                            compact && !tpEnabled && "hidden"
                        )}>
                            {!compact && (
                                <>
                                    <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                                        <TrendingUp className="w-48 h-48 text-emerald-500" />
                                    </div>
                                    <div className="flex items-center justify-between relative z-10 mb-4">
                                        <h3 className="font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 text-[11px]">
                                            <TrendingUp className="w-4 h-4" /> {mode === 'COVER' ? 'TP' : 'Kar Al'}
                                        </h3>
                                        <button 
                                            onClick={() => setTpEnabled(!tpEnabled)}
                                            className={cn(
                                                "w-8 h-4 rounded-full transition-all relative px-0.5",
                                                tpEnabled ? "bg-emerald-500" : "bg-slate-700"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-3 h-3 bg-white rounded-full transition-all",
                                                tpEnabled ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                </>
                            )}

                            <div className={cn("transition-opacity duration-300 relative z-10", compact ? "space-y-1.5" : "space-y-4", !tpEnabled && "opacity-30 pointer-events-none")}>
                                <div className={cn(compact ? "space-y-1" : "space-y-2")}>
                                    <div className="flex justify-between items-end mb-0.5 leading-none">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hedef Fiyat</span>
                                        <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">
                                            {displayTpPercent >= 0 ? '+' : ''}{displayTpPercent.toFixed(2)}%
                                        </span>
                                    </div>

                                    {!isSplitTp ? (
                                        <div className={cn("animate-in fade-in zoom-in-95", compact ? "space-y-2.5" : "space-y-4")}>
                                            {compact ? (
                                                <div className="space-y-1.5 px-0.5">
                                                    <input 
                                                        type="range" 
                                                        min="0.1" max="100.0" step="0.1"
                                                        value={Math.abs(tpPercent)}
                                                        onChange={(e) => {
                                                            const pct = parseFloat(e.target.value);
                                                            const targetPct = mode === 'COVER' ? -pct : pct;
                                                            const newPrice = buyP * (1 + (targetPct / 100));
                                                            setTpPrice(newPrice.toFixed(6));
                                                        }}
                                                        className="w-full h-1 rounded-full cursor-pointer accent-emerald-400 bg-slate-800/50 appearance-none transition-all"
                                                    />
                                                    <div className="flex justify-between items-center px-0.5">
                                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter font-mono">{tpPrice} USDT</span>
                                                        <span className="text-[9px] font-black text-emerald-400 font-mono">{tpPercent >= 0 ? '+' : ''}{tpPercent.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={tpPrice}
                                                        onChange={(e) => setTpPrice(e.target.value)}
                                                        className={cn("w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 text-sm font-black text-white outline-none focus:border-emerald-500/50 transition-all", compact ? "h-8 py-0" : "py-2.5")}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => {
                                                    setIsSplitTp(true);
                                                    setTpTargets([{ id: '1', price: tpPrice, volume: 100 }]);
                                                }}
                                                className={cn("w-full rounded-lg border border-white/10 bg-white/5 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2 group/split", compact ? "py-1.5" : "py-2.5")}
                                            >
                                                <Split className="w-3 h-3 text-emerald-400 group-hover/split:rotate-12 transition-transform" />
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Hedefleri Böl</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5">
                                                <span>Fiyat</span>
                                                <span>Miktar %</span>
                                            </div>
                                            <div className={cn("space-y-1.5 custom-scrollbar pr-1", compact ? "max-h-[160px]" : "max-h-[320px] overflow-y-auto")}>
                                                {tpTargets.map((target) => {
                                                    const tP = parseFloat(target.price) || 0;
                                                    const tPct = buyP > 0 ? ((tP / buyP) - 1) * 100 : 0;
                                                    const dPct = mode === 'COVER' ? -tPct : tPct;
                                                    return (
                                                        <div key={target.id} className="grid grid-cols-3 gap-1.5 items-center">
                                                            <input 
                                                                type="text"
                                                                value={target.price}
                                                                onChange={(e) => updateTpTarget(target.id, { price: e.target.value })}
                                                                placeholder="0.0"
                                                                className="bg-slate-900/50 border border-slate-800 rounded px-1.5 py-1 text-[11px] font-mono text-white outline-none focus:border-cyan-500/50 col-span-2 h-7"
                                                            />
                                                            <div className="flex items-center justify-between">
                                                                <span className={cn(
                                                                    "text-[10px] font-black",
                                                                    dPct >= 0 ? "text-emerald-400" : "text-rose-400"
                                                                )}>
                                                                    {dPct.toFixed(1)}%
                                                                </span>
                                                                <button onClick={() => removeTpTarget(target.id)} className="text-slate-700 hover:text-rose-400 transition-colors">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <div className="col-span-3 flex items-center gap-2">
                                                                <input 
                                                                    type="range"
                                                                    min="1" max="100"
                                                                    value={target.volume}
                                                                    onChange={(e) => updateTpTarget(target.id, { volume: parseInt(e.target.value) })}
                                                                    className="flex-1 accent-emerald-500 h-1 rounded-full bg-slate-800"
                                                                />
                                                                <span className="text-[8px] font-black text-white w-6 text-right">{target.volume}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="pt-1.5 flex items-center justify-between border-t border-white/5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase">Toplam:</span>
                                                    <span className={cn("text-[9px] font-black", totalTpVolume === 100 ? "text-emerald-400" : "text-rose-400")}>
                                                        {totalTpVolume}%
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={addTpTarget}
                                                        disabled={tpTargets.length >= 8}
                                                        className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[8px] font-black text-emerald-400 uppercase disabled:opacity-30"
                                                    >
                                                        + HEDEF
                                                    </button>
                                                    <button 
                                                        onClick={() => setIsSplitTp(false)}
                                                        className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[8px] font-black text-slate-400 uppercase"
                                                    >
                                                        İPTAL
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={cn("pt-2 border-t border-white/5", compact ? "space-y-1" : "space-y-2 mt-4")}>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-7">TTP</span>
                                        <button 
                                            onClick={() => setTrailingTp(!trailingTp)}
                                            className={cn(
                                                "w-8 h-4 rounded-full transition-all relative px-0.5 border border-white/10",
                                                trailingTp ? "bg-emerald-500" : "bg-slate-700/50 hover:bg-slate-600"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                                trailingTp ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>

                                    {trailingTp && (
                                        <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                                            <div className="flex flex-col items-end -space-y-1 pr-1">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter opacity-60">Sapma</span>
                                                <span className="text-[9px] font-black text-emerald-400 font-mono leading-none tracking-tighter">{tpDeviation.toFixed(1)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="-9.9" max="-0.1" step="0.1" 
                                                value={tpDeviation}
                                                onChange={(e) => setTpDeviation(parseFloat(e.target.value))}
                                                className="w-32 h-1 rounded-full cursor-pointer accent-emerald-400 hover:accent-emerald-300 bg-slate-800/50 appearance-none transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STOP LOSS CONFIGURATION PANEL */}
                    {((slEnabled && showAdvanced) || !compact) && (
                        <div className={cn(
                            "relative overflow-hidden group/sl transition-all duration-300",
                            compact ? "p-0 bg-transparent border-t border-white/5 pt-2" : "bg-slate-950/20 p-4 rounded-2xl border border-white/5",
                            compact && !slEnabled && "hidden"
                        )}>
                            {!compact && (
                                <>
                                    <div className="absolute top-12 right-0 p-8 opacity-[0.03] pointer-events-none">
                                        <ShieldAlert className="w-48 h-48 text-rose-500" />
                                    </div>
                                    <div className="flex items-center justify-between relative z-10 mb-4">
                                        <h3 className="font-black text-rose-400 uppercase tracking-widest flex items-center gap-2 text-[11px]">
                                            <ShieldAlert className="w-4 h-4" /> {mode === 'COVER' ? 'SL' : 'Stop Loss'}
                                        </h3>
                                        <button 
                                            onClick={() => setSlEnabled(!slEnabled)}
                                            className={cn(
                                                "w-8 h-4 rounded-full transition-all relative px-0.5",
                                                slEnabled ? "bg-rose-500" : "bg-slate-700"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-3 h-3 bg-white rounded-full transition-all",
                                                slEnabled ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                </>
                            )}

                            <div className={cn("transition-opacity duration-300 relative z-10", compact ? "space-y-1.5" : "space-y-4", !slEnabled && "opacity-30 pointer-events-none")}>
                                <div className={cn(compact ? "space-y-1" : "space-y-2")}>
                                    <div className="flex justify-between items-end mb-0.5 leading-none">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stop Seviyesi</span>
                                        <span className="text-[10px] font-black text-rose-400 font-mono tracking-tighter">
                                            {displaySlPercent >= 0 ? '+' : ''}{displaySlPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                    {compact ? (
                                        <div className="space-y-1.5 px-0.5">
                                            <input 
                                                type="range" 
                                                min="0.1" max="20.0" step="0.1"
                                                value={Math.abs(slPercent)}
                                                onChange={(e) => {
                                                    const pct = parseFloat(e.target.value);
                                                    const targetPct = mode === 'COVER' ? pct : -pct;
                                                    const newPrice = buyP * (1 + (targetPct / 100));
                                                    setSlPrice(newPrice.toFixed(6));
                                                }}
                                                className="w-full h-1 rounded-full cursor-pointer accent-rose-400 bg-slate-800/50 appearance-none transition-all"
                                            />
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter font-mono">{slPrice} USDT</span>
                                                <span className="text-[9px] font-black text-rose-400 font-mono">{slPercent >= 0 ? '+' : ''}{slPercent.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={slPrice}
                                                onChange={(e) => setSlPrice(e.target.value)}
                                                className={cn("w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 text-sm font-black text-white outline-none focus:border-rose-500/50", compact ? "h-8 py-0" : "py-2.5")}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">USDT</div>
                                        </div>
                                    )}
                                </div>

                                <div className={cn("border-t border-white/5", compact ? "pt-1.5 space-y-2" : "pt-3 space-y-4 mt-4")}>
                                    {/* Trailing Stop Loss */}
                                    <div className="space-y-1 pt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-7">TSL</span>
                                                <button 
                                                    onClick={() => setTrailingSl(!trailingSl)}
                                                    className={cn(
                                                        "w-8 h-4 rounded-full transition-all relative px-0.5 border border-white/10",
                                                        trailingSl ? "bg-rose-500" : "bg-slate-700/50 hover:bg-slate-600"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                                        trailingSl ? "translate-x-4" : "translate-x-0"
                                                    )} />
                                                </button>
                                            </div>
                                            
                                            {trailingSl && (
                                                <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                                                    <div className="flex flex-col items-end -space-y-1 pr-1">
                                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter opacity-60">Sapma</span>
                                                        <span className="text-[9px] font-black text-rose-400 font-mono leading-none tracking-tighter">{trailingSlDev.toFixed(1)}%</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min="-9.9" max="-0.1" step="0.1" 
                                                        value={trailingSlDev}
                                                        onChange={(e) => setTrailingSlDev(parseFloat(e.target.value))}
                                                        className="w-32 h-1 rounded-full cursor-pointer accent-rose-400 hover:accent-rose-300 bg-slate-800/50 appearance-none transition-all"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SL Timeout */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SL Timeout (Wick)</span>
                                            <button 
                                                onClick={() => setSlTimeout(!slTimeout)}
                                                className={cn(
                                                    "w-8 h-4 rounded-full transition-all relative px-0.5",
                                                    slTimeout ? "bg-amber-500" : "bg-slate-700"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-3 h-3 bg-white rounded-full transition-all",
                                                    slTimeout ? "translate-x-4" : "translate-x-0"
                                                )} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Move to Breakeven */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Maliyete Taşı (BE)</span>
                                              {compact && !(isSplitTp && tpTargets.length >= 2) && (
                                                  <span className="text-[8px] text-slate-600">2+ TP hedefi gerekli</span>
                                              )}
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    if (isSplitTp && tpTargets.length >= 2) {
                                                        setMoveToBreakeven(!moveToBreakeven);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-8 h-4 rounded-full transition-all relative px-0.5",
                                                    moveToBreakeven && isSplitTp && tpTargets.length >= 2 ? "bg-emerald-500" : "bg-slate-700",
                                                    !(isSplitTp && tpTargets.length >= 2) && "opacity-30 cursor-not-allowed"
                                                )}
                                                disabled={!(isSplitTp && tpTargets.length >= 2)}
                                            >
                                                <div className={cn(
                                                    "w-3 h-3 bg-white rounded-full transition-all",
                                                    moveToBreakeven && isSplitTp && tpTargets.length >= 2 ? "translate-x-4" : "translate-x-0"
                                                )} />
                                            </button>
                                        </div>
                                        {moveToBreakeven && isSplitTp && tpTargets.length >= 2 && (
                                            <div className="text-[8px] text-emerald-400/80 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                                ✓ İlk hedefte SL maliyete taşınır
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* ACTION BUTTON (MOVED TO BOTTOM) */}
            <div className={cn(compact ? "pt-3 mt-2 border-t border-white/5" : "mt-6")}>
                <button 
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={cn(
                        "w-full rounded-xl font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group/submit shadow-xl",
                        compact ? "py-2.5 text-[11px]" : "py-4 text-[13px]",
                        mode === 'COVER' 
                            ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" 
                            : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/20",
                        isLoading && "opacity-50 cursor-wait"
                    )}
                    title={editingTrade ? "İşlem değişikliklerini kaydet" : (mode === 'COVER' ? "Cover stratejisini başlat" : "Yeni trade emri oluştur")}
                    id="smart-trade-submit-btn"
                >
                    <div className="absolute pointer-events-none inset-0 bg-white/10 translate-y-full group-hover/submit:translate-y-0 transition-transform duration-500" />
                    <span className="relative z-10 flex items-center justify-center gap-2 text-slate-950 font-black pointer-events-none">
                        {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4 fill-slate-950" />
                        )}
                        {editingTrade ? 'KAYDET' : (mode === 'COVER' ? 'Cover Başlat' : 'Trade Oluştur')}
                    </span>
                </button>
            </div>
            </HorizonCard>
        </div>
    );
};
