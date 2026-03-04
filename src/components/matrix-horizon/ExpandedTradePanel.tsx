import React from 'react';
import { SmartTradeOrder } from '../ActiveSmartTrades';
import { cn } from '@/lib/utils';
import { 
    Clock, 
    Brain, 
    ZapOff, 
    Radar, 
    ExternalLink, 
    TrendingUp, 
    Zap, 
    RefreshCw, 
    ShieldAlert 
} from 'lucide-react';

interface ExpandedTradePanelProps {
    trade: SmartTradeOrder;
    currentPrice: number;
    isClosed: boolean;
    meta: Record<string, any>;
    entry: number;
    aiScore: number;
    statusText: string;
    tp: number;
    payload: Record<string, any>;
    pnlPercent: number;
    pnlUsdt: number;
    onEdit?: (trade: SmartTradeOrder) => void;
    handlePanicClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
    handleSilentClose: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
    handleFlashOpen: (e: React.MouseEvent, trade: SmartTradeOrder) => void;
    fetchTrades: () => void;
}

export const ExpandedTradePanel: React.FC<ExpandedTradePanelProps> = ({
    trade,
    currentPrice,
    isClosed,
    meta,
    entry,
    aiScore,
    statusText,
    tp,
    payload,
    pnlPercent,
    pnlUsdt,
    onEdit,
    handlePanicClose,
    handleSilentClose,
    handleFlashOpen,
    fetchTrades,
}) => {
    return (
        <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-slate-950/40 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-4 gap-6">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
                     <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">KONSOLİDE İSTATİSTİKLER</span>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Miktar ({trade.symbol.split('/')[0]})</span>
                            <span className="text-xs font-black text-white">{trade.qty.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Varlık (USDT)</span>
                            <span className="text-xs font-black text-white">${(trade.qty * currentPrice).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">TP Uzaklığı</span>
                            <span className="text-xs font-black text-emerald-400">
                                {tp > 0 ? `${(((tp - currentPrice) / currentPrice) * 100 * (trade.side === 'BUY' ? 1 : -1)).toFixed(2)}%` : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                     <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">SİSTEM DENETİM GÜNLÜĞÜ</span>
                    <div className="space-y-1.5 overflow-hidden">
                        <div className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-400/5 px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/10">
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            <Clock className="w-2.5 h-2.5" /> Giriş: ${entry} @ {meta.filledAt ? new Date(meta.filledAt).toLocaleTimeString([], { hour12: false }) : 'BAŞLANGIÇ'}
                        </div>
                        {meta.entryReason && (
                            <div className="text-[10px] font-mono text-cyan-500/70 uppercase px-2 py-0.5 ml-4 border-l border-white/5">
                                ↳ Sebep: {meta.entryReason}
                            </div>
                        )}
                        <div className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-400/5 px-2 py-1 rounded flex items-center gap-1 border border-cyan-500/10">
                            <Brain className="w-2.5 h-2.5" /> AI Skoru: {aiScore}% Tepe Güven
                        </div>
                        
                        {isClosed ? (
                            <div className="text-[10px] font-mono text-rose-400 uppercase bg-rose-400/5 px-2 py-1 rounded flex items-center gap-1 border border-rose-500/10 mt-2">
                                <ZapOff className="w-2.5 h-2.5" /> 
                                SİSTEM DIŞI: {meta.exitReason || 'SİSTEM_KAPATILDI'}
                            </div>
                        ) : (
                            <div className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-400/10 px-2 py-1 rounded flex items-center gap-1 border border-cyan-500/20 animate-pulse">
                                <Radar className="w-2.5 h-2.5 animate-spin" /> {statusText} AKTİF
                            </div>
                        )}
                        
                        <div className="text-[10px] font-mono text-slate-600 uppercase px-1 pt-1 opacity-50 flex justify-between items-center">
                            <span>Oluşturma: {new Date(trade.created_at).toLocaleTimeString([], { hour12: false })}</span>
                            {isClosed && meta.closedAt && <span>Kapanış: {new Date(meta.closedAt).toLocaleTimeString([], { hour12: false })}</span>}
                        </div>
                    </div>
                </div>

                 {trade.status !== 'CLOSED' ? (
                    <>
                        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-center gap-2">
                             <a 
                                href={`https://www.mexc.com/exchange/${trade.symbol.replace('/', '_')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-755 rounded-lg transition-all border border-slate-700 text-white text-xs font-black uppercase tracking-widest"
                            >
                                <ExternalLink className="w-4 h-4" />
                                MEXC GÖRÜNTÜLE
                            </a>
                            <button 
                                 onClick={(e) => { 
                                     e.stopPropagation(); 
                                     if (onEdit) onEdit(trade); 
                                 }}
                                 className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest"
                             >
                                 <TrendingUp className="w-4 h-4" />
                                 DÜZENLE
                             </button>
                             {trade.status === 'PENDING' && payload.trailingBuy && (
                                 <button 
                                     onClick={(e) => handleFlashOpen(e, trade)}
                                     className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest animate-pulse"
                                     title="TBY beklemeden hemen piyasa fiyatından işleme gir"
                                 >
                                     <Zap className="w-4 h-4" />
                                     HIZLI GİRİŞ
                                 </button>
                             )}
                             <button
                                 onClick={(e) => { e.stopPropagation(); fetchTrades(); }}
                                 className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-lg transition-all border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-widest"
                                 title="Verileri sunucudan yeniden yükle"
                                 aria-label="Force Sync"
                             >
                                 <RefreshCw className="w-4 h-4" />
                                 HIZLI SENK
                             </button>
                        </div>

                        <div className="flex flex-col gap-3 p-4">
                            <button 
                                onClick={(e) => handlePanicClose(e, trade)}
                                className="group/panic flex flex-col items-center justify-center gap-2 w-full h-[90px] border-2 border-dashed border-rose-500/20 hover:border-rose-500/60 hover:bg-rose-500/10 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(244,63,94,0)] hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                            >
                                <ZapOff className="w-7 h-7 text-rose-500/40 group-hover/panic:text-rose-500 group-hover/panic:scale-110 transition-all" />
                                 <span className="text-xs font-black text-rose-500/40 group-hover/panic:text-rose-500 uppercase tracking-[0.2em]">PANİK ÇIKIŞ (PİYASA SATIŞ)</span>
                            </button>

                             <button 
                                 onClick={(e) => handleSilentClose(e, trade)}
                                 className="group/silent flex flex-col items-center justify-center gap-2 w-full h-[60px] border border-slate-800 hover:border-slate-700 hover:bg-white/5 rounded-2xl transition-all duration-300"
                                 title="İşlemi kapatmadan sadece listeden kaldır"
                                 aria-label="Sessiz Arşiv"
                             >
                                 <div className="flex items-center gap-2">
                                     <RefreshCw className="w-4 h-4 text-slate-500 group-hover/silent:text-slate-300 group-hover/silent:rotate-180 transition-all duration-700" />
                                     <span className="text-xs font-black text-slate-500 group-hover/silent:text-slate-300 uppercase tracking-[0.2em]">EMRİ KAPAT (SESSİZ ARŞİV)</span>
                                 </div>
                             </button>
                        </div>
                    </>
                ) : (
                    <div className="col-span-2 p-5 bg-slate-950/60 border border-slate-800/50 rounded-2xl relative overflow-hidden group/audit">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/audit:opacity-10 transition-opacity">
                            <ShieldAlert className="w-24 h-24 text-cyan-500" />
                        </div>
                        
                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                                <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center">
                                    <ShieldAlert className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">KAPANIŞ DENETİM KAYDI</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">POZİSYON TAMAMLANDI VE ARŞİVLENDİ</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">KAPANIŞ TETİKLEYİCİ</span>
                                    <span className={cn(
                                        "text-[11px] font-black uppercase",
                                        meta.exitReason?.includes('MANUAL') || meta.exitReason?.includes('MANUEL') ? "text-amber-400" : "text-emerald-400"
                                    )}>
                                        {meta.exitReason?.includes('MANUAL') || meta.exitReason?.includes('MANUEL') ? '● KULLANICI KOMUTU (MANUEL)' : '● MATRIX AI MONİTÖR'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">ANA SEBEP</span>
                                    <span className="text-[11px] font-black text-white uppercase truncate" title={meta.exitReason}>
                                        {meta.exitReason ? (
                                            meta.exitReason === 'MANUAL_PANIC_EXIT' ? 'PANİK SATIŞ TETİKLENDİ' :
                                            meta.exitReason === 'MANUAL_SILENT_EXIT' ? 'SESSİZ ARŞİV (POZİSYON KORUNDU)' :
                                            meta.exitReason
                                        ) : 'BİLİNMEYEN SİSTEM ÇIKIŞI'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">SON ÇIKIŞ FİYATI</span>
                                    <span className="text-[11px] font-black text-white font-mono">
                                        ${currentPrice.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">KAPANIŞ ZAMANI</span>
                                    <span className="text-[11px] font-black text-slate-300 font-mono">
                                        {meta.closedAt ? new Date(meta.closedAt).toLocaleString([], { hour12: false }) : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                                <div className="flex justify-between items-center bg-slate-900/40 px-3 py-2 rounded-lg border border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">MEXC Emir ID</span>
                                    <span className="text-[10px] font-mono text-cyan-500/80">
                                        {meta.exitResult?.orderId || 'INTERNAL_LIQUIDATION'}
                                    </span>
                                </div>
                                <div className="bg-emerald-500/5 px-3 py-2 rounded-lg border border-emerald-500/10 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-emerald-500/70 uppercase">Toplam Sonuç (PNL)</span>
                                    <span className={cn("text-[11px] font-black font-mono", pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}% | ${pnlUsdt.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
