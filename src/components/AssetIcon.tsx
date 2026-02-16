"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';

interface AssetIconProps {
    symbol: string;
    className?: string;
    size?: number;
}

export const AssetIcon = ({ symbol, className = "w-7 h-7", size = 28 }: AssetIconProps) => {
    const [iconIndex, setIconIndex] = useState(0);

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
    
    // Exact TradingView sources (The browser can see these if the Ticker Tape does)
    const sources = useMemo(() => [
        // 1. TV - Binance Variant (Most common for TV)
        `https://s3-symbol-logo.tradingview.com/crypto/BINANCE--${assetUpper}.svg`,
        // 2. TV - Bitstamp Variant (Backup for majors)
        `https://s3-symbol-logo.tradingview.com/crypto/BITSTAMP--${assetUpper}.svg`,
        // 3. TV - MEXC Variant (Direct match)
        `https://s3-symbol-logo.tradingview.com/crypto/MEXC--${assetUpper}.svg`,
        // 4. TV - Standard Crypto
        `https://s3-symbol-logo.tradingview.com/crypto/${assetUpper}.svg`,
        // 5. Coincap (Solid public backup)
        `https://assets.coincap.io/assets/icons/${asset}@2x.png`,
        // 6. Binance Direct ICU
        `https://bin.bnbstatic.com/image/admin_mgt/icu/icon/${assetUpper}.png`
    ], [asset, assetUpper]);

    const handleError = () => {
        if (iconIndex < sources.length - 1) {
            setIconIndex(prev => prev + 1);
        } else {
            setIconIndex(sources.length); 
        }
    };

    if (!asset || iconIndex >= sources.length) {
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
                src={sources[iconIndex]}
                alt={symbol}
                width={size}
                height={size}
                className="w-full h-full rounded-full relative z-10 bg-transparent object-contain transition-transform hover:scale-110 duration-200"
                onError={handleError}
                unoptimized
            />
        </div>
    );
};
