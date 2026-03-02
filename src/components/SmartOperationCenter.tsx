"use client";

import React, { useState, useEffect } from 'react';
import { SmartTrade } from './SmartTrade';
import { ActiveSmartTrades, SmartTradeOrder } from './ActiveSmartTrades';
import { debugLog } from '@/services/api';
import { useTrade } from '@/context/TradeContext';

export const SmartOperationCenter = () => {
    const [isClient, setIsClient] = useState(false);
    const { 
        symbol, setSymbol, 
        buyPrice, setBuyPrice, 
        tpPrice, setTpPrice, 
        slPrice, setSlPrice, 
        tpEnabled, setTpEnabled, 
        slEnabled, setSlEnabled,
        editingTrade, setEditingTrade,
        isPanelOpen, setIsPanelOpen
    } = useTrade();
    
    useEffect(() => {
        // Use timeout to avoid synchronous cascading render lint error
        const timer = setTimeout(() => setIsClient(true), 0);
        debugLog('info', 'SmartOperationCenter Mounted');
        return () => clearTimeout(timer);
    }, []);

    const terminalRef = React.useRef<HTMLDivElement>(null);
    const activeTradesRef = React.useRef<HTMLDivElement>(null);

    const handleSaveSuccess = () => {
        setEditingTrade(null);
        setIsPanelOpen(false);
        activeTradesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCancelEdit = () => {
        setEditingTrade(null);
        setIsPanelOpen(false);
    };

    const handleNew = () => {
        setEditingTrade(null);
        setIsPanelOpen(true);
        terminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleEdit = (trade: SmartTradeOrder) => {
        const p = trade.meta.payload;
        setEditingTrade(trade);
        setSymbol(trade.symbol);
        setBuyPrice(p.buyPrice?.toString() || "0");
        setTpPrice(p.takeProfit?.price?.toString() || "0");
        setSlPrice(p.stopLoss?.price?.toString() || "0");
        setTpEnabled(!!p.takeProfit);
        setSlEnabled(!!p.stopLoss);
        setIsPanelOpen(true);
        setTimeout(() => {
            terminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    if (!isClient) {
        return (
            <div className="w-full h-[600px] bg-slate-950/20 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-black text-cyan-500 uppercase tracking-widest">Başlatılıyor...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div ref={activeTradesRef}>
                <ActiveSmartTrades 
                    onEdit={handleEdit}
                    onNewTrade={handleNew}
                />
            </div>

            {/* Unified Terminal Module (Chart + Trade) - Hidden by default, shown only during Edit or if explicitly opened */}
            {(isPanelOpen || editingTrade) && (
                <div ref={terminalRef} className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <SmartTrade 
                        controlledSymbol={symbol}
                        onSymbolChange={setSymbol}
                        controlledBuyPrice={buyPrice}
                        onBuyPriceChange={setBuyPrice}
                        controlledTpPrice={tpPrice}
                        onTpPriceChange={setTpPrice}
                        controlledSlPrice={slPrice}
                        onSlPriceChange={setSlPrice}
                        controlledTpEnabled={tpEnabled}
                        onTpEnabledChange={setTpEnabled}
                        controlledSlEnabled={slEnabled}
                        onSlEnabledChange={setSlEnabled}
                        editingTrade={editingTrade ?? undefined}
                        onCancelEdit={handleCancelEdit}
                        onSaveSuccess={handleSaveSuccess}
                    />
                </div>
            )}
        </div>
    );
};
