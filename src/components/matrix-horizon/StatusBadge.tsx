import React from 'react';
import { SmartTradeOrder } from '../ActiveSmartTrades';
import { F4Data } from '@/lib/trading-logic';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

interface StatusBadgeProps {
    meta: SmartTradeOrder['meta'];
    side: 'BUY' | 'SELL';
    isClosed: boolean;
    timeframe: string;
    liveData: F4Data | null;
    statusText: string;
    statusColor: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ meta, side, isClosed, timeframe, liveData, statusText, statusColor }) => {
    return (
        <div className="text-center group/status relative">
            {meta.monitorError && !isClosed && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[9px] px-2 py-1 rounded shadow-2xl z-50 whitespace-nowrap animate-bounce font-black border border-rose-400/50 flex items-center gap-1.5 min-w-[150px] justify-center">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{meta.monitorError === 'VOLATILITY_GAP_PROTECTION' ? 'OYNADAKLIK KORUMASI (BEKLE)' : `HATA: ${meta.monitorError.toUpperCase()}`}</span>
                </div>
            )}
            <div className={cn(
                "text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest whitespace-nowrap flex flex-col items-center transition-colors duration-500",
                meta.monitorError && !isClosed ? "border-rose-500 bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]" :
                isClosed ? "border-white/10 bg-white/5 text-slate-500 animate-none opacity-50" : (
                    statusColor === "text-emerald-400" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 animate-pulse" :
                    statusColor === "text-rose-400" ? "border-rose-500/20 bg-rose-500/5 text-rose-400 animate-pulse" :
                    statusColor === "text-amber-400" ? "border-amber-500/20 bg-amber-500/5 text-amber-400 animate-pulse" :
                    "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 animate-pulse"
                )
            )}>
                <span className="opacity-50 text-[7px] mb-0.5">{isClosed ? 'ARŞİVLENMİŞ İŞLEM VERİSİ' : liveData ? `${timeframe.toUpperCase()} CANLI SİNYAL` : 'YZ ALIM-SATIM YAKLAŞIMI'}</span>
                {isClosed ? (side === 'SELL' ? 'SATIŞ TAMAM' : 'ALIM TAMAM') : (meta.monitorError ? 'ÇIKIŞ HATASI' : statusText)}
            </div>
        </div>
    );
};
