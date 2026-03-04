import { useReducer, useEffect, useCallback, useRef } from 'react';

export interface WhaleAlert {
    id: string;
    symbol: string;
    amount: number;
    valueUsd: number;
    side: 'BUY' | 'SELL';
    time: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MAX_HISTORY = 100;
const CLEANUP_INTERVAL_MS = 30_000;

// --- Reducer for idiomatic high-frequency state updates ---

type AlertState = { latest: WhaleAlert | null; history: WhaleAlert[] };
type AlertAction =
    | { type: 'ADD'; payload: WhaleAlert }
    | { type: 'CLEANUP' };

function alertReducer(state: AlertState, action: AlertAction): AlertState {
    switch (action.type) {
        case 'ADD':
            // Prepend only – no O(N) scan here; cleanup handles purging
            return {
                latest: action.payload,
                history: [action.payload, ...state.history].slice(0, MAX_HISTORY),
            };
        case 'CLEANUP': {
            const cutoff = Date.now() - TWO_DAYS_MS;
            const filtered = state.history.filter(a => a.time > cutoff);
            // Return same reference if nothing changed – avoids unnecessary re-renders
            return filtered.length === state.history.length ? state : { ...state, history: filtered };
        }
        default:
            return state;
    }
}

export function useWhaleRadar() {
    const [{ latest: alert, history: alerts }, dispatch] = useReducer(alertReducer, {
        latest: null,
        history: [],
    });
    const [status, setStatus] = useReducer<React.Reducer<ConnectionStatus, ConnectionStatus>>(
        (_prev, next) => next,
        'disconnected'
    );
    const wsRef = useRef<WebSocket | null>(null);

    // Periodic cleanup — runs every 30s, not on every WS message
    useEffect(() => {
        const cleanup = setInterval(() => dispatch({ type: 'CLEANUP' }), CLEANUP_INTERVAL_MS);
        return () => clearInterval(cleanup);
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }

        setStatus('connecting');
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade');

        ws.onopen = () => setStatus('connected');

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const price = parseFloat(data.p);
                const quantity = parseFloat(data.q);
                const valueUsd = price * quantity;
                if (valueUsd > 100000) {
                    dispatch({
                        type: 'ADD',
                        payload: {
                            id: String(data.a),
                            symbol: 'BTC',
                            amount: quantity,
                            valueUsd,
                            side: (data.m as boolean) ? 'SELL' : 'BUY',
                            time: data.T as number,
                        },
                    });
                }
            } catch {
                // Ignore parse errors
            }
        };

        ws.onerror = () => {
            setStatus('error');
            ws.close();
        };

        ws.onclose = () => setStatus('disconnected');

        wsRef.current = ws;
    }, []); // No outside dependencies — dispatch is stable

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
            setStatus('disconnected');
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return { alert, alerts, status, connect, disconnect };
}
