"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';

interface AssetIconProps {
    symbol: string;
    className?: string;
    size?: number;
}

// Global registry to cache working icon URLs across all instances
const ICON_CACHE_KEY = 'matrix_asset_icon_cache';
let IconRegistry: Record<string, string> = {};
let saveTimeout: NodeJS.Timeout | null = null;

const getSources = (asset: string) => {
    const assetUpper = asset.toUpperCase();
    return [
        `https://s3-symbol-logo.tradingview.com/crypto/BINANCE--${assetUpper}.svg`,
        `https://s3-symbol-logo.tradingview.com/crypto/BITSTAMP--${assetUpper}.svg`,
        `https://s3-symbol-logo.tradingview.com/crypto/MEXC--${assetUpper}.svg`,
        `https://s3-symbol-logo.tradingview.com/crypto/${assetUpper}.svg`,
        `https://assets.coincap.io/assets/icons/${asset}@2x.png`,
        `https://bin.bnbstatic.com/image/admin_mgt/icu/icon/${assetUpper}.png`
    ];
};

// Load cache from localStorage on module initialization (client-side only)
if (typeof window !== 'undefined') {
    try {
        const stored = localStorage.getItem(ICON_CACHE_KEY);
        if (stored) IconRegistry = JSON.parse(stored);
    } catch (e) {
        console.error('[AssetIcon] Failed to load icon cache:', e);
    }
}

const updateRegistry = (asset: string, url: string) => {
    if (IconRegistry[asset] === url) return;
    
    IconRegistry[asset] = url;
    
    // Debounce localStorage write to avoid CPU spikes during bulk icon discovery
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (typeof window === 'undefined') return;
        try {
            // Serializes the latest state of the module-level registry
            localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(IconRegistry));
        } catch {
            // Quota exceeded or restricted environment - silent fail is appropriate for non-critical cache
        }
        saveTimeout = null;
    }, 1000);
};

export const AssetIcon = ({ symbol, className = "w-7 h-7", size = 28 }: AssetIconProps) => {
    // Intelligent base asset extraction
    const asset = useMemo(() => {
        if (!symbol) return '';
        let base = symbol.split(/[/_-]/)[0];
        const commonQuotes = ['USDT', 'USDC', 'BUSD', 'TUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY'];
        for (const quote of commonQuotes) {
            if (base.endsWith(quote) && base.length > quote.length) {
                base = base.substring(0, base.length - quote.length);
                break;
            }
        }
        return base.toLowerCase();
    }, [symbol]);

    const assetUpper = asset.toUpperCase();
    const sortedSources = useMemo(() => getSources(asset), [asset]);
    
    const [iconIndex, setIconIndex] = useState(0);

    // Apply cached index after mount to prevent SSR hydration mismatch
    React.useEffect(() => {
        const cachedUrl = IconRegistry[asset];
        if (cachedUrl) {
            const idx = sortedSources.indexOf(cachedUrl);
            if (idx > 0) {
                setIconIndex(idx);
            }
        }
    }, [asset, sortedSources]);

    const handleLoad = () => {
        if (iconIndex < sortedSources.length) {
            updateRegistry(asset, sortedSources[iconIndex]);
        }
    };

    const handleError = () => {
        if (iconIndex < sortedSources.length - 1) {
            setIconIndex(prev => prev + 1);
        } else {
            setIconIndex(sortedSources.length); 
        }
    };

    if (!asset || iconIndex >= sortedSources.length) {
        return (
            <div 
                className={`${className} rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-400 select-none shadow-inner`}
                style={{ fontSize: `${Math.max(size/3, 8)}px`, width: size, height: size }}
            >
                {assetUpper.substring(0, 2) || '?'}
            </div>
        );
    }

    return (
        <div className={`relative ${className} flex-shrink-0 flex items-center justify-center`}>
            {/* Soft glow matching TV aesthetics */}
            <div className="absolute inset-0 bg-white/5 rounded-full blur-[1px]" />
            <Image 
                src={sortedSources[iconIndex]}
                alt={symbol}
                width={size}
                height={size}
                className="w-full h-full rounded-full relative z-10 bg-transparent object-contain transition-transform hover:scale-110 duration-200"
                onLoad={handleLoad}
                onError={handleError}
                unoptimized
            />
        </div>
    );
};
