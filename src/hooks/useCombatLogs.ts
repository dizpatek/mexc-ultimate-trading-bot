import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { AxiosError } from 'axios';
import { normalizeSymbol, extractBaseAsset } from '@/lib/symbol-utils';

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'EXECUTION' | 'SYSTEM' | 'AI_DECISION' | 'WHALE_ALERT' | 'STRUCTURE' | 'F4_SIGNAL';
    message: string;
    details?: string;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    level?: string;
    /** Pre-parsed asset symbol (e.g. 'BTCUSDT') for efficient portfolio filtering */
    assetSymbol?: string;
}

let globalLastScanTime = 0;

export function useCombatLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
    const [lastScanTime, setLastScanTime] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        try {
            const response = await api.get('/logs/signals');
            const data = response.data;
            setError(null);
            
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

                    let detailText: string | undefined;
                    let timeframeSuffix = '';

                    if (!isSystem && sig.detail) {
                        try {
                            const raw = sig.detail;
                            let extractedDetail: string | undefined;
                            
                            if (typeof raw === 'object') {
                                extractedDetail = (raw as Record<string, unknown>)?.detail ? String((raw as Record<string, unknown>).detail) : undefined;
                            } else if (typeof raw === 'string' && raw.startsWith('{')) {
                                const parsed = JSON.parse(raw);
                                extractedDetail = parsed?.detail ? String(parsed.detail) : undefined;
                            } else {
                                extractedDetail = sig.executed ? `ONAYLANDI: ${sig.strategy_name}` : String(raw);
                            }

                            if (extractedDetail) {
                                const timeframeMatch = extractedDetail.match(/\(([^)]+)\)$/);
                                if (timeframeMatch) {
                                    timeframeSuffix = ` ${timeframeMatch[0]}`;
                                    // Optionally remove timeframe from detailText if we want it only in message
                                    detailText = extractedDetail; 
                                } else {
                                    detailText = extractedDetail;
                                }
                            }
                        } catch {
                            detailText = sig.executed ? `ONAYLANDI: ${sig.strategy_name}` : String(sig.detail);
                        }
                    } else if (isSystem) {
                        detailText = sig.detail;
                    }

                    let message: string;
                    if (isSystem) {
                        message = sig.detail;
                    } else if (isWhale) {
                        message = `🐋 WHALE: ${sig.symbol}${timeframeSuffix}`;
                    } else if (isTrade) {
                        message = `${sig.type}: ${sig.symbol} @ ${sig.price}${timeframeSuffix}`;
                    } else if (isStructure) {
                        message = `📐 ${sig.type}: ${sig.symbol}${timeframeSuffix}`;
                    } else if (isF4) {
                        message = `⚡ ${sig.type.replace(/_/g, ' ')}: ${sig.symbol}${timeframeSuffix}`;
                    } else {
                        message = `🎯 AI: ${sig.symbol}${timeframeSuffix}`;
                    }

                    return {
                        id: sig.id,
                        timestamp: Number(sig.timestamp),
                        type: logType,
                        message,
                        details: detailText,
                        // Pre-parse and store assetSymbol for O(1) portfolio filtering later
                        assetSymbol: isSystem ? undefined : normalizeSymbol(sig.symbol),
                        sentiment: sig.type === 'BUY' || sig.type === 'F4_CONFIRMED_BUY' || sig.type === 'F4_EARLY_BUY' ? 'POSITIVE' : 
                                   sig.type === 'SELL' || sig.type === 'F4_CONFIRMED_SELL' || sig.type === 'F4_EARLY_SELL' ? 'NEGATIVE' : 'NEUTRAL',
                        level: isSystem ? sig.type : undefined
                    };
                });
                setLogs(formattedLogs.slice(0, 200)); // cap to keep filtering cost bounded
            }
        } catch (err) {
            console.error('Fetch Logs Error:', err);
            setError('Veri Çekilemedi');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const triggerScan = useCallback(async () => {
        const now = Date.now();
        if (now - globalLastScanTime < 30000) return;

        try {
            setScanStatus('scanning');
            await api.get('/signals/scan');
            globalLastScanTime = Date.now();
            setLastScanTime(globalLastScanTime);
            setScanStatus('done');
            await fetchLogs();
        } catch (err: unknown) {
            if (err instanceof AxiosError) {
                if (err.response?.status === 429) {
                    // Ignore rate limit 429 errors silently
                    setScanStatus('idle');
                } else if (err.response?.status === 400) {
                    // User errors (like missing keys) should be shown
                    const msg = err.response.data?.error || 'Geçersiz İstek';
                    setError(msg);
                    setScanStatus('idle');
                } else {
                    console.error('Signal Scan Error:', err);
                    setScanStatus('idle');
                }
            } else {
                console.error('Signal Scan Error:', err);
                setScanStatus('idle');
            }
        }
    }, [fetchLogs]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    useEffect(() => {
        triggerScan();
        const scanInterval = setInterval(triggerScan, 60000);
        return () => clearInterval(scanInterval);
    }, [triggerScan]);

    return { logs, scanStatus, lastScanTime, isLoading, error, fetchLogs, triggerScan };
}

// --- Log Processing Utilities (exported to keep CombatLog as a pure UI layer) ---

const FILTERED_SYSTEM_PREFIXES = [
    'Matrix Engine Online:',
    'STRATEGY_CYCLE_START',
];

export function deduplicateSystemLogs(logs: LogEntry[], defaults: LogEntry[]): LogEntry[] {
    const seen = new Set<string>();
    const rawSystemLogs = logs.filter(l => {
        if (l.type !== 'SYSTEM') return false;
        if (FILTERED_SYSTEM_PREFIXES.some(p => l.message.startsWith(p))) return false;
        if (seen.has(l.message)) return false;
        seen.add(l.message);
        return true;
    });
    return [...rawSystemLogs, ...defaults].sort((a, b) => b.timestamp - a.timestamp);
}

export function filterSignalsByHoldings(
    tradeLogs: LogEntry[],
    holdings: { symbol: string }[] | null | undefined
): LogEntry[] {
    // P3.1 Fix: If holdings are null (loading state), don't fallback to all logs
    // returning an empty array prevents the "popping" effect where all signals appear briefly then disappear
    if (holdings === null || holdings === undefined) return [];
    
    // Normalize held symbols: remove slashes and USDT suffix if any, then upper
    // Filter out stablecoins to avoid noise
    const heldBases = new Set(
        holdings
            .filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC')
            .map(h => extractBaseAsset(h.symbol))
    );
    
    return tradeLogs.filter(l => {
        if (!l.assetSymbol) return false;
        // Always include global signals as they are relevant to everyone
        if (l.assetSymbol === 'GLOBAL') return true;
        
        // Normalize log symbol using extractBaseAsset
        const logBase = extractBaseAsset(l.assetSymbol);
        return heldBases.has(logBase);
    });
}
