"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Activity, Crosshair, Zap, Radar } from 'lucide-react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

interface LogEntry {
    id: string;
    timestamp: number;
    type: 'EXECUTION' | 'SYSTEM' | 'AI_DECISION' | 'WHALE_ALERT' | 'STRUCTURE' | 'F4_SIGNAL';
    message: string;
    details?: string;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    level?: string;
}

export const CombatLog = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
    const [lastScanTime, setLastScanTime] = useState<number | null>(null);
    const tradeScrollRef = useRef<HTMLDivElement>(null);
    const systemScrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = useCallback(async () => {
        try {
            const response = await api.get('/logs/signals');
            const data = response.data;
            
            if (Array.isArray(data)) {
                const formattedLogs: LogEntry[] = data.map((sig: { id: string; symbol: string; strategy_name: string; type: string; price: string; timestamp: string; executed: boolean; detail: string }) => {
                    const isTrade = sig.type === 'BUY' || sig.type === 'SELL';
                    const isWhale = sig.type === 'WHALE';
                    const isSystem = sig.symbol === 'SYSTEM';
                    const isStructure = sig.type === 'BOS' || sig.type === 'CHoCH';
                    const isF4 = sig.type.startsWith('F4_');
                    
                    let logType: LogEntry['type'] = 'AI_DECISION';
                    if (isTrade) logType = 'EXECUTION';
                    else if (isWhale) logType = 'WHALE_ALERT';
                    else if (isSystem) logType = 'SYSTEM';
                    else if (isStructure) logType = 'STRUCTURE';
                    else if (isF4) logType = 'F4_SIGNAL';

                    let message: string;
                    if (isSystem) {
                        message = sig.detail;
                    } else if (isWhale) {
                        message = `🐋 WHALE: ${sig.symbol}`;
                    } else if (isTrade) {
                        message = `${sig.type}: ${sig.symbol} @ ${sig.price}`;
                    } else if (isStructure) {
                        message = `📐 ${sig.type}: ${sig.symbol}`;
                    } else if (isF4) {
                        message = `⚡ ${sig.type.replace(/_/g, ' ')}: ${sig.symbol}`;
                    } else {
                        message = `🎯 AI: ${sig.symbol}`;
                    }

                    // Safe detail parsing
                    let detailText: string | undefined;
                    if (!isSystem && sig.detail) {
                        try {
                            const raw = sig.detail;
                            if (typeof raw === 'object') {
                                detailText = (raw as Record<string, unknown>)?.detail ? String((raw as Record<string, unknown>).detail) : undefined;
                            } else if (typeof raw === 'string' && raw.startsWith('{')) {
                                const parsed = JSON.parse(raw);
                                detailText = parsed?.detail ? String(parsed.detail) : undefined;
                            } else {
                                detailText = sig.executed ? `ONAYLANDI: ${sig.strategy_name}` : String(raw);
                            }
                        } catch {
                            detailText = sig.executed ? `ONAYLANDI: ${sig.strategy_name}` : String(sig.detail);
                        }
                    }

                    return {
                        id: sig.id,
                        timestamp: Number(sig.timestamp),
                        type: logType,
                        message,
                        details: detailText,
                        sentiment: sig.type === 'BUY' || sig.type === 'F4_CONFIRMED_BUY' || sig.type === 'F4_EARLY_BUY' ? 'POSITIVE' : 
                                   sig.type === 'SELL' || sig.type === 'F4_CONFIRMED_SELL' || sig.type === 'F4_EARLY_SELL' ? 'NEGATIVE' : 'NEUTRAL',
                        level: isSystem ? sig.type : undefined
                    };
                });
                setLogs(formattedLogs);
            }
        } catch (err) {
            console.error('Fetch Logs Error:', err);
        }
    }, []);

    // Signal scanner trigger
    const triggerScan = useCallback(async () => {
        try {
            setScanStatus('scanning');
            await api.get('/signals/scan');
            setLastScanTime(Date.now());
            setScanStatus('done');
            // Re-fetch logs after scan to show new signals
            await fetchLogs();
        } catch (err) {
            console.error('Signal Scan Error:', err);
            setScanStatus('idle');
        }
    }, [fetchLogs]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    // Trigger scanner every 60 seconds
    useEffect(() => {
        triggerScan();
        const scanInterval = setInterval(triggerScan, 60000);
        return () => clearInterval(scanInterval);
    }, [triggerScan]);

    const tradeLogs = logs.filter(l => l.type !== 'SYSTEM');
    const systemLogs = logs.filter(l => l.type === 'SYSTEM' && !l.message.includes('Matrix Engine Online: Kullanıcı oturumu başlatıldı, tüm modüller senkronize ediliyor.'));

    const tradeLogsLength = tradeLogs.length;
    const systemLogsLength = systemLogs.length;

    useEffect(() => {
        if (tradeScrollRef.current) tradeScrollRef.current.scrollTop = 0;
    }, [tradeLogsLength]);

    useEffect(() => {
        if (systemScrollRef.current) systemScrollRef.current.scrollTop = 0;
    }, [systemLogsLength]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'EXECUTION': return <Zap className="w-3 h-3 text-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
            case 'WHALE_ALERT': return <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />;
            case 'AI_DECISION': return <Crosshair className="w-3 h-3 text-purple-400" />;
            case 'STRUCTURE': return <Crosshair className="w-3 h-3 text-amber-400" />;
            case 'F4_SIGNAL': return <Zap className="w-3 h-3 text-emerald-400" />;
            case 'SYSTEM': return <Terminal className="w-3 h-3 text-blue-400" />;
            default: return <Terminal className="w-3 h-3 text-slate-500" />;
        }
    };

    const getSystemLogStyle = (level?: string) => {
        switch (level) {
            case 'ERROR': return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: 'text-rose-500' };
            case 'WARN': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-500' };
            case 'SUCCESS': return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-500 glow-text-emerald' };
            case 'INFO': return { text: 'text-cyan-400', bg: 'bg-transparent', border: 'border-transparent', icon: 'text-cyan-500' };
            default: return { text: 'text-slate-400', bg: 'bg-transparent', border: 'border-transparent', icon: 'text-slate-600' };
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Main Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20">
                        <Terminal className="w-4 h-4 text-cyan-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-cyan-100 uppercase tracking-[0.3em]">Combat Dual Terminal v2.4</h3>
                </div>
                <div className="flex items-center gap-4">
                    {/* Scan Status */}
                    <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider transition-colors",
                        scanStatus === 'scanning' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                        scanStatus === 'done' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                        "bg-slate-950 border-white/5 text-slate-600"
                    )}>
                        <Radar className={cn("w-3 h-3", scanStatus === 'scanning' && 'animate-spin')} />
                        {scanStatus === 'scanning' ? 'TARANIYOR' : scanStatus === 'done' ? 'TARAMA OK' : 'BEKLEME'}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-slate-950 border border-white/5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">LIVE SYNC</span>
                    </div>
                </div>
            </div>

            {/* Content Area - Dual Split */}
            <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
                {/* LEFT: SIGNAL FEED */}
                <div className="flex-1 flex flex-col bg-slate-950/20 max-w-[50%]">
                    <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                             <Zap size={10} className="text-yellow-400" /> Sinyal Akışı
                        </span>
                        {lastScanTime && (
                            <span className="text-[8px] text-slate-700 font-mono">
                                Son: {new Date(lastScanTime).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div ref={tradeScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-[11px] custom-scrollbar">
                        {tradeLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                                <Radar className={cn("w-6 h-6 opacity-30", scanStatus === 'scanning' && 'animate-spin')} />
                                <div>{scanStatus === 'scanning' ? 'SİNYALLER TARANIYOR...' : 'SİNYAL HATTI ANALİZ EDİLİYOR...'}</div>
                                <div className="text-[8px] text-slate-800/50 mt-1">8 coin · 1dk aralık · 60sn döngü</div>
                            </div>
                        ) : tradeLogs.map((log) => (
                             <LogLine key={log.id} log={log} icon={getIcon(log.type)} />
                        ))}
                    </div>
                </div>

                {/* RIGHT: SYSTEM CONSOLE */}
                <div className="flex-1 flex flex-col bg-slate-900/10">
                    <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={10} className="text-blue-400" /> Sistem Konsolu
                        </span>
                    </div>
                    <div ref={systemScrollRef} className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono text-[10px] custom-scrollbar">
                        {systemLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                                <Activity size={12} className="opacity-20 animate-spin" />
                                <div>KONSOL BAŞLATILIYOR...</div>
                            </div>
                        ) : systemLogs.map((log) => {
                            const style = getSystemLogStyle(log.level);
                            return (
                                <div key={log.id} className={cn("flex gap-2 group p-1.5 rounded transition-colors border", style.bg, style.border)}>
                                    <span className="text-slate-600 shrink-0 select-none opacity-70">
                                        [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}]
                                    </span>
                                    <span className={cn("shrink-0 select-none font-bold", style.icon)}>{'>'}_</span>
                                    <span className={cn("flex-1 break-word drop-shadow-sm", style.text)}>
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Input Overlay */}
            <div className="px-4 py-1.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <span className="text-cyan-500 font-black">{'>'}</span>
                    <input type="text" placeholder="Matrix kernel scan active..." className="bg-transparent border-none outline-none text-[10px] text-slate-500 placeholder:text-slate-800 w-full font-mono uppercase tracking-widest" disabled />
                </div>
                <div className="text-[9px] font-black text-slate-700 tracking-[0.2em]">MATRIX V5.3.4 ALPHA</div>
            </div>
        </div>
    );
};

const LogLine = ({ log, icon }: { log: LogEntry; icon: React.ReactNode }) => (
    <div className="group flex gap-2.5 animate-in fade-in slide-in-from-left-1 duration-300">
        <div className="text-slate-600 shrink-0 select-none opacity-50 text-[10px] mt-0.5">
            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="mt-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-all">
            {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
            <span className={cn(
                "font-black tracking-tight flex items-center gap-2",
                log.type === 'WHALE_ALERT' ? 'text-cyan-400' :
                log.type === 'EXECUTION' ? 'text-yellow-400 glow-yellow' :
                log.type === 'AI_DECISION' ? 'text-purple-400' :
                log.type === 'STRUCTURE' ? 'text-amber-400' :
                log.type === 'F4_SIGNAL' ? 'text-emerald-400' : 'text-slate-300'
            )}>
                {log.message}
                {log.type === 'EXECUTION' && <span className="text-[8px] bg-yellow-400/10 px-1 border border-yellow-400/20 rounded animate-pulse">TRADE</span>}
                {log.type === 'STRUCTURE' && <span className="text-[8px] bg-amber-400/10 px-1 border border-amber-400/20 rounded">SMC</span>}
                {log.type === 'F4_SIGNAL' && <span className="text-[8px] bg-emerald-400/10 px-1 border border-emerald-400/20 rounded">F4</span>}
            </span>
            {log.details && (
                <span className="text-slate-500 text-[10px] truncate opacity-70 group-hover:opacity-100 transition-opacity">{log.details}</span>
            )}
        </div>
    </div>
);
