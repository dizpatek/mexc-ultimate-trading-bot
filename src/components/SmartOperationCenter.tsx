"use client";

import React, { useState, useEffect } from 'react';
import { SmartTrade } from './SmartTrade';
import { debugLog } from '@/services/api';

export const SmartOperationCenter = () => {
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        // Use timeout to avoid synchronous cascading render lint error
        const timer = setTimeout(() => setIsClient(true), 0);
        debugLog('info', 'SmartOperationCenter Mounted');
        return () => clearTimeout(timer);
    }, []);
    
    // Shared State for sync
    const [symbol, setSymbol] = useState('BTC/USDT');
    
    // Diagnostic ping
    useEffect(() => {
        if (isClient) {
            fetch('/api/portfolio/summary?debug=SmartOperationCenterMounted').catch(() => {});
        }
    }, [isClient]);

    const [buyPrice, setBuyPrice] = useState(0.4632);
    const [tpPrice, setTpPrice] = useState(0.5095);
    const [slPrice, setSlPrice] = useState(0.4400);
    const [tpEnabled, setTpEnabled] = useState(true);
    const [slEnabled, setSlEnabled] = useState(true);

    if (!isClient) {
        return (
            <div className="w-full h-[600px] bg-slate-950/20 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Başlatılıyor...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Unified Terminal Module (Chart + Trade) */}
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
            />
        </div>
    );
};
