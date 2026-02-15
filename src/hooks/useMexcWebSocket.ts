import { useEffect, useRef, useState } from 'react';

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



    // Dedup symbols to prevent unnecessary re-subscriptions
    const symbolsString = symbols.sort().join(',');

    useEffect(() => {
        if (symbols.length === 0) {
            return;
        }

        let isMounted = true;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            if (!isMounted) return;

            const ws = new WebSocket(MEXC_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isMounted) return;
                console.log('✅ MEXC WebSocket Connected');
                setIsConnected(true);
                
                // Subscribe
                 const msg = {
                    method: 'SUBSCRIPTION',
                    params: symbols.map(s => `spot@public.deals.v3.api@${s}`)
                };
                ws.send(JSON.stringify(msg));

                // Setup Ping (Keep-alive) every 30s
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ method: 'PING' }));
                    }
                }, 30000);
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
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
                } catch (err) {
                    // console.error('WS Parse Error', err);
                }
            };

            ws.onclose = () => {
                if (!isMounted) return;
                console.log('❌ MEXC WebSocket Disconnected');
                setIsConnected(false);
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
                
                // Auto-reconnect after 3s
                reconnectTimeout = setTimeout(() => {
                    console.log('🔄 Attempting Reconnect...');
                    connect();
                }, 3000);
            };

            ws.onerror = (err) => {
                console.error('MEXC WebSocket Error:', err);
                ws.close();
            };
        };

        connect();

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, [symbolsString]); // eslint-disable-line react-hooks/exhaustive-deps

    return { tickerData, isConnected };
}
