// API service to connect to our backend
import axios from 'axios';

// In Next.js, API routes are relative
const API_BASE_URL = '/api'; // Changed from localhost:3000 to relative path

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add auth token to requests
if (typeof window !== 'undefined') {
    api.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });
}

export { api };

export interface PortfolioData {
    totalValue: number;
    change24h: number;
    changePercentage: number;
    assets: number;
}

export interface Holding {
    id: string;
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    holding: number;
    value: number;
    allocation: number;
}

export interface Trade {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    price: number;
    amount: number;
    total: number;
    time: string;
    status: 'completed' | 'pending' | 'failed';
    profitLoss?: number;
    profitLossPercentage?: number;
}

export interface TradeSignal {
    signal: 'buy' | 'sell';
    pair: string;
    risk?: number;
    tp?: number[];
    sl?: number[];
    amount?: number;
    usdt?: number;
    secret?: string;
}

// Fetch portfolio summary
export const fetchPortfolioSummary = async (): Promise<PortfolioData> => {
    const response = await api.get('/portfolio/summary');
    return response.data;
};

// Fetch holdings
export const fetchHoldings = async (): Promise<Holding[]> => {
    const response = await api.get('/portfolio/holdings');
    return response.data;
};

// Fetch recent trades
export const fetchRecentTrades = async (): Promise<Trade[]> => {
    const response = await api.get('/portfolio/trades');
    return response.data;
};

// Send trade signal
export const sendTradeSignal = async (signal: TradeSignal) => {
    const response = await api.post('/webhook', signal);
    return response.data;
};
