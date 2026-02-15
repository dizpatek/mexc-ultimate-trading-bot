"use client";

import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Crosshair, Zap } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: number;
    type: 'EXECUTION' | 'SYSTEM' | 'AI_DECISION' | 'WHALE_ALERT';
    message: string;
    details?: string;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export const CombatLog = () => {
    const [logs, setLogs] = useState<LogEntry[]>(() => [
        { id: '1', timestamp: Date.now() - 50000, type: 'SYSTEM', message: 'Matrix V3 Motoru Başlatıldı', details: 'Çekirdek alt sistemler çevrimiçi', sentiment: 'NEUTRAL' },
        { id: '2', timestamp: Date.now() - 40000, type: 'AI_DECISION', message: 'Piyasa Yapısı Analiz Ediliyor', details: '150+ varlık taranıyor', sentiment: 'NEUTRAL' },
        { id: '3', timestamp: Date.now() - 20000, type: 'WHALE_ALERT', message: 'Balina Tespit Edildi: BTCUSDT', details: 'Hacim artışı > 2.5x SD', sentiment: 'POSITIVE' },
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Simulated Log Stream
    useEffect(() => {
        const interval = setInterval(() => {
            const newLog: LogEntry = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                type: Math.random() > 0.7 ? 'WHALE_ALERT' : Math.random() > 0.5 ? 'AI_DECISION' : 'SYSTEM',
                message: Math.random() > 0.5 ? 'Algoritmik Tarama Tamamlandı' : 'Volatilite Rejimi Değişti',
                details: 'Yeni sinyaller işleniyor...',
                sentiment: Math.random() > 0.5 ? 'POSITIVE' : 'NEGATIVE'
            };
            setLogs(prev => [...prev.slice(-19), newLog]); // Keep last 20
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'EXECUTION': return <Zap className="w-3 h-3 text-yellow-400" />;
            case 'WHALE_ALERT': return <Activity className="w-3 h-3 text-cyan-400" />;
            case 'AI_DECISION': return <Crosshair className="w-3 h-3 text-purple-400" />;
            default: return <Terminal className="w-3 h-3 text-slate-500" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-bold text-cyan-100 uppercase tracking-widest">SAVAŞ GÜNLÜĞÜ</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">CANLI AKIŞ</span>
                </div>
            </div>

            {/* Log Area */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs custom-scrollbar"
            >
                {logs.map((log) => (
                    <div key={log.id} className="group flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        {/* Timestamp */}
                        <div className="text-slate-600 shrink-0 select-none">
                            [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}]
                        </div>
                        
                        {/* Icon */}
                        <div className="mt-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                            {getIcon(log.type)}
                        </div>

                        {/* Content */}
                        <div className="flex flex-col">
                            <span className={`font-medium ${
                                log.type === 'WHALE_ALERT' ? 'text-cyan-400' :
                                log.type === 'EXECUTION' ? 'text-yellow-400' :
                                log.type === 'AI_DECISION' ? 'text-purple-300' :
                                'text-slate-300'
                            }`}>
                                {log.message}
                            </span>
                            {log.details && (
                                <span className="text-slate-500 text-[10px]">{log.details}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input / Filter (Visual only for now) */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/30 flex items-center gap-2">
                <span className="text-cyan-500">{'>'}</span>
                <input 
                    type="text" 
                    placeholder="Sistem kayıtlarını filtrele..." 
                    className="bg-transparent border-none outline-none text-xs text-slate-400 placeholder:text-slate-700 w-full font-mono"
                    disabled
                />
            </div>
        </div>
    );
};
