"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SmartTradeOrder } from '@/components/ActiveSmartTrades';

interface TradeContextType {
    symbol: string;
    setSymbol: (s: string) => void;
    buyPrice: string;
    setBuyPrice: (p: string) => void;
    tpPrice: string;
    setTpPrice: (p: string) => void;
    slPrice: string;
    setSlPrice: (p: string) => void;
    tpEnabled: boolean;
    setTpEnabled: (e: boolean) => void;
    slEnabled: boolean;
    setSlEnabled: (e: boolean) => void;
    mode: 'TRADE' | 'COVER';
    setMode: (m: 'TRADE' | 'COVER') => void;
    editingTrade: SmartTradeOrder | null;
    setEditingTrade: (trade: SmartTradeOrder | null) => void;
    isPanelOpen: boolean;
    setIsPanelOpen: (open: boolean) => void;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export const TradeProvider = ({ children }: { children: ReactNode }) => {
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [buyPrice, setBuyPrice] = useState('0');
    const [tpPrice, setTpPrice] = useState('0');
    const [slPrice, setSlPrice] = useState('0');
    const [tpEnabled, setTpEnabled] = useState(true);
    const [slEnabled, setSlEnabled] = useState(true);
    const [mode, setMode] = useState<'TRADE' | 'COVER'>('TRADE');
    const [editingTrade, setEditingTrade] = useState<SmartTradeOrder | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    return (
        <TradeContext.Provider value={{
            symbol, setSymbol,
            buyPrice, setBuyPrice,
            tpPrice, setTpPrice,
            slPrice, setSlPrice,
            tpEnabled, setTpEnabled,
            slEnabled, setSlEnabled,
            mode, setMode,
            editingTrade, setEditingTrade,
            isPanelOpen, setIsPanelOpen
        }}>
            {children}
        </TradeContext.Provider>
    );
};

export const useTrade = () => {
    const context = useContext(TradeContext);
    if (!context) throw new Error('useTrade must be used within a TradeProvider');
    return context;
};
