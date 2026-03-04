"use client";

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, MutableRefObject } from 'react';
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
    /** Ref to be attached to the SmartTrade panel element for scrolling */
    tradeAnchorRef: MutableRefObject<HTMLElement | null>;
    /** Scroll to the trade panel. Sets pendingScroll if element is not yet mounted. */
    scrollToTrade: () => void;
    /** True when a scroll was requested but the panel element was not found yet */
    pendingScroll: boolean;
    /** Call from inside the trade panel after it mounts to consume the pending scroll */
    consumePendingScroll: () => void;
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
    const [pendingScroll, setPendingScroll] = useState(false);
    const tradeAnchorRef = useRef<HTMLElement | null>(null);

    const scrollToTrade = useCallback(() => {
        const el = tradeAnchorRef.current;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Ref not attached yet — set flag for panel to consume on mount
            setPendingScroll(true);
        }
    }, []);

    const consumePendingScroll = useCallback(() => {
        if (pendingScroll) {
            setPendingScroll(false);
            // Small defer to let sidebar transition actually start/mount 
            setTimeout(() => {
                tradeAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [pendingScroll]);

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
            isPanelOpen, setIsPanelOpen,
            tradeAnchorRef,
            scrollToTrade,
            pendingScroll,
            consumePendingScroll,
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
