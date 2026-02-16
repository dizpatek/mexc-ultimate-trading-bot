import { useEffect, useRef, useState } from 'react';

interface TickerData {
    s: string; // Symbol
    p: string; // Price
    r: string; // Price change percent
    t: number; // Timestamp
}

/**
 * Hook to get real-time price updates from MEXC.
 * Uses REST polling as a robust fallback for the deprecated V3 JSON WebSocket.
 * 
 * @param symbols Array of symbols to track (e.g. ['BTCUSDT', 'ETHUSDT'])
 */
interface MexcTicker {
    symbol: string;
    price: string;
}

export function useMexcWebSocket(symbols: string[]) {
    const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
    const [isConnected, setIsConnected] = useState(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Dedup symbols to prevent unnecessary re-subscriptions
    const symbolsString = [...new Set(symbols)].sort().join(',');

    useEffect(() => {
        let isMounted = true;

        if (symbols.length === 0) {
            // No symbols, no connection needed.
            return;
        }

        const fetchPrices = async () => {
            try {
                const symbolsJson = JSON.stringify(symbols);
                const url = `/api/market/ticker?symbols=${encodeURIComponent(symbolsJson)}`;
                
                const response = await fetch(url);
                const data = await response.json();

                if (!isMounted) return;
                
                if (data.error) {
                    throw new Error(data.error);
                }

                if (Array.isArray(data)) {
                    const newUpdates: Record<string, TickerData> = {};
                    const now = Date.now();
                    
                    data.forEach((item: MexcTicker) => {
                        newUpdates[item.symbol] = {
                            s: item.symbol,
                            p: item.price,
                            r: '0', 
                            t: now
                        };
                    });

                    setTickerData(prev => ({
                        ...prev,
                        ...newUpdates
                    }));
                    setIsConnected(true);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('[useMexcWebSocket] Proxy Polling Error:', err);
                    setIsConnected(false);
                }
            }
        };

        fetchPrices();
        pollIntervalRef.current = setInterval(fetchPrices, 3000);

        return () => {
            isMounted = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [symbolsString, symbols]);

    return { tickerData, isConnected };
}
