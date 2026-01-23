import { useEffect, useRef, useState, useCallback } from 'react';

const MEXC_WS_URL = 'wss://wbs.mexc.com/ws';

interface TickerData {
    s: string; // Symbol
    p: string; // Price
    r: string; // Price change percent
    t: number; // Timestamp
}

/**
 * Hook to connect to MEXC WebSocket for real-time tickers
 * @param symbols Array of symbols to subscribe to (e.g. ['BTCUSDT', 'ETHUSDT'])
 */
export function useMexcWebSocket(symbols: string[]) {
    const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const subscribe = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && symbols.length > 0) {
            const msg = {
                method: 'SUBSCRIPTION',
                params: symbols.map(s => `spot@public.deals.v3.api@${s}`)
            };
            wsRef.current.send(JSON.stringify(msg));
        }
    }, [symbols]);

    useEffect(() => {
        // Initialize WebSocket
        const ws = new WebSocket(MEXC_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ MEXC WebSocket Connected');
            setIsConnected(true);
            subscribe();

            // Setup Ping (Keep-alive) every 30s
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ method: 'PING' }));
                }
            }, 30000);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                // Handle Deal (Trade) Update - Using deals for frequent updates
                // MEXC format: { c: channel, d: { deals: [{ p: price, ... }] }, ... }
                if (msg.d && msg.d.deals) {
                    const deals = msg.d.deals;
                    const channel = msg.c; // e.g. spot@public.deals.v3.api@BTCUSDT
                    const symbol = channel.split('@').pop(); // Extract BTCUSDT

                    if (symbol && deals.length > 0) {
                        const lastDeal = deals[deals.length - 1]; // Latest trade

                        setTickerData(prev => ({
                            ...prev,
                            [symbol]: {
                                s: symbol,
                                p: lastDeal.p,
                                r: '0', // Deals don't have 24h change, unfortunately
                                t: lastDeal.t
                            }
                        }));
                    }
                }

                // Handle standard Ticker Update (slower but has 24h change)
                // Use 'spot@public.limit.depth.v3.api@BTCUSDT' or similar if needed

            } catch (err) {
                // console.error('WS Parse Error', err);
            }
        };

        ws.onclose = () => {
            console.log('❌ MEXC WebSocket Disconnected');
            setIsConnected(false);
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        };

        ws.onerror = (err) => {
            console.error('MEXC WebSocket Error:', err);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, [subscribe]); // Re-connect if symbols change usually isn't desired, but here we keep it simple

    return { tickerData, isConnected };
}
