"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Play, Pause, TrendingUp, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import { useMexcWebSocket } from '../hooks/useMexcWebSocket';

interface DcaBot {
    id: number;
    symbol: string;
    amount: number;
    interval_hours: number;
    take_profit_percent?: number;
    total_invested: number;
    total_bought_qty: number;
    average_price: number;
    status: string;
    last_run_at: number;
    created_at: number;
}

export const DcaManager = () => {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [newBot, setNewBot] = useState({
        symbol: 'BTCUSDT',
        amount: '10',
        intervalHours: '24',
        takeProfitPercent: '10'
    });

    // Fetch Bots
    const { data: bots, isLoading } = useQuery<DcaBot[]>({
        queryKey: ['dca-bots'],
        queryFn: async () => {
            const res = await api.get('/trade/dca');
            return res.data;
        }
    });

    // Real-time prices for PnL calculation
    const symbols = bots?.map(b => b.symbol) || [];
    const { tickerData } = useMexcWebSocket(symbols);

    // Create Bot Mutation
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/trade/dca', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dca-bots'] });
            setIsAdding(false);
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return api.delete(`/trade/dca?id=${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dca-bots'] });
        }
    });

    const calculatePnL = (bot: DcaBot) => {
        if (!tickerData[bot.symbol] || bot.total_bought_qty === 0) return { val: 0, pct: 0 };
        const currentPrice = parseFloat(tickerData[bot.symbol].p);
        const currentValue = bot.total_bought_qty * currentPrice;
        const invested = Number(bot.total_invested);
        const pnl = currentValue - invested;
        const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
        return { val: pnl, pct: pnlPct };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-green-500" /> DCA Bots
                    </h2>
                    <p className="text-muted-foreground">Automated Dollar Cost Averaging strategies.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Bot
                </button>
            </div>

            {isAdding && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6 animate-in fade-in zoom-in-95">
                    <h3 className="text-lg font-semibold mb-4">Create New DCA Bot</h3>
                    <div className="grid md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Asset</label>
                            <select
                                className="input-field w-full"
                                value={newBot.symbol}
                                onChange={e => setNewBot({ ...newBot, symbol: e.target.value })}
                            >
                                <option value="BTCUSDT">BTC/USDT</option>
                                <option value="ETHUSDT">ETH/USDT</option>
                                <option value="SOLUSDT">SOL/USDT</option>
                                <option value="BNBUSDT">BNB/USDT</option>
                                <option value="XRPUSDT">XRP/USDT</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Buy Amount (USDT)</label>
                            <input
                                type="number"
                                className="input-field w-full"
                                value={newBot.amount}
                                onChange={e => setNewBot({ ...newBot, amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Interval (Hours)</label>
                            <select
                                className="input-field w-full"
                                value={newBot.intervalHours}
                                onChange={e => setNewBot({ ...newBot, intervalHours: e.target.value })}
                            >
                                <option value="1">Every 1 Hour</option>
                                <option value="4">Every 4 Hours</option>
                                <option value="12">Every 12 Hours</option>
                                <option value="24">Daily (24h)</option>
                                <option value="168">Weekly (168h)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-semibold text-muted-foreground block mb-1">Take Profit (%)</label>
                            <input
                                type="number"
                                className="input-field w-full"
                                value={newBot.takeProfitPercent}
                                onChange={e => setNewBot({ ...newBot, takeProfitPercent: e.target.value })}
                                placeholder="Optional"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="btn-outline">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate({
                                symbol: newBot.symbol,
                                amount: parseFloat(newBot.amount),
                                intervalHours: parseInt(newBot.intervalHours),
                                takeProfitPercent: newBot.takeProfitPercent ? parseFloat(newBot.takeProfitPercent) : null
                            })}
                            className="btn-primary"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Start Bot'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground">Loading bots...</div>
                ) : bots?.length === 0 && !isAdding ? (
                    <div className="col-span-full py-12 border-2 border-dashed border-border rounded-xl text-center">
                        <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                        <h3 className="font-medium">No active DCA bots</h3>
                        <p className="text-muted-foreground text-sm">Start an automated accumulation strategy.</p>
                    </div>
                ) : (
                    bots?.map(bot => {
                        const { val: pnl, pct: pnlPct } = calculatePnL(bot);
                        const nextRun = new Date(Number(bot.last_run_at) + (bot.interval_hours * 3600000));
                        const isProfit = pnl >= 0;

                        return (
                            <div key={bot.id} className="stat-card relative overflow-hidden flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={`https://api.iconify.design/cryptocurrency-color:${bot.symbol.replace('USDT', '').toLowerCase()}.svg`}
                                            className="w-8 h-8 rounded-full"
                                            alt={bot.symbol}
                                        />
                                        <div>
                                            <h3 className="font-bold">{bot.symbol}</h3>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Every {bot.interval_hours}h
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteMutation.mutate(bot.id)}
                                        className="text-muted-foreground hover:text-red-500 p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Invested</span>
                                        <span className="font-mono">${Number(bot.total_invested).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Current PnL</span>
                                        <span className={`font-mono font-medium ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                            {isProfit ? '+' : ''}{pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Next Buy</span>
                                        <span className="text-xs">
                                            {bot.total_invested == 0 ? "Pending Start" : nextRun.toLocaleTimeString()}
                                        </span>
                                    </div>
                                    {bot.take_profit_percent && (
                                        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                                            <div
                                                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (pnlPct / bot.take_profit_percent) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Target: {bot.take_profit_percent}% Profit</span>
                                    <span>#{bot.id}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
