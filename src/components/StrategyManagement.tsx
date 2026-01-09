"use client";

import { useState } from 'react';
import { Play, Pause, Plus, Trash2, Activity, Settings2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Strategy {
    id: number;
    name: string;
    symbol: string;
    strategy_type: string;
    active: boolean;
    parameters: any;
}

export const StrategyManagement = () => {
    const queryClient = useQueryClient();
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [showWebhookInfo, setShowWebhookInfo] = useState(false);
    const [newStrategy, setNewStrategy] = useState({ name: '', symbol: 'BTCUSDT', type: 'RSI' });

    const { data: strategies, isLoading, isError } = useQuery<Strategy[]>({
        queryKey: ['strategies'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/strategies', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        }
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, active }: { id: number, active: boolean }) => {
            const token = localStorage.getItem('token');
            return axios.patch(`/api/strategies/${id}`, { active: !active }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['strategies'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const token = localStorage.getItem('token');
            return axios.delete(`/api/strategies/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['strategies'] });
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const token = localStorage.getItem('token');
            return axios.post('/api/strategies', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['strategies'] });
            setIsAddingMode(false);
        }
    });

    if (isLoading) return <div className="stat-card animate-pulse h-64 flex items-center justify-center">Loading strategies...</div>;

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Trading Phases (Strategies)</h2>
                    <p className="text-muted-foreground">Manage your automated trading loops and active bot phases.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowWebhookInfo(!showWebhookInfo)}
                        className="btn-outline flex items-center gap-2"
                    >
                        <Settings2 className="w-4 h-4" /> Webhook Setup
                    </button>
                    <button
                        onClick={() => setIsAddingMode(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Strategy
                    </button>
                </div>
            </div>

            {showWebhookInfo && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" />
                                TradingView Webhook Integration
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Use these details to trigger trades directly from your TradingView alerts.
                            </p>
                        </div>
                        <button onClick={() => setShowWebhookInfo(false)} className="text-muted-foreground hover:text-foreground">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Webhook URL</label>
                            <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all">
                                https://mexc-ultimate-trading-bot.vercel.app/api/webhook
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Secret Key</label>
                            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                                {process.env.NEXT_PUBLIC_WEBHOOK_SECRET || 'Check .env file (WEBHOOK_SECRET)'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Example Payload (JSON)</label>
                        <pre className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto text-foreground">
                            {`{
  "secret": "YOUR_SECRET_KEY",
  "symbol": "BTCUSDT",
  "signal": "buy",  // or "sell"
  "risk": 0.01      // 1% of balance
}`}
                        </pre>
                    </div>
                </div>
            )}

            {isAddingMode && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Strategy</h3>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Strategy Name"
                            className="input-field"
                            value={newStrategy.name}
                            onChange={e => setNewStrategy({ ...newStrategy, name: e.target.value })}
                        />
                        <select
                            className="input-field"
                            value={newStrategy.symbol}
                            onChange={e => setNewStrategy({ ...newStrategy, symbol: e.target.value })}
                        >
                            <option value="BTCUSDT">BTC/USDT</option>
                            <option value="ETHUSDT">ETH/USDT</option>
                            <option value="SOLUSDT">SOL/USDT</option>
                        </select>
                        <select
                            className="input-field"
                            value={newStrategy.type}
                            onChange={e => setNewStrategy({ ...newStrategy, type: e.target.value })}
                        >
                            <option value="RSI">RSI Reversal</option>
                            <option value="MACD">MACD Crossover</option>
                            <option value="MA_CROSS">Moving Average Cross</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAddingMode(false)} className="btn-outline">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate({
                                name: newStrategy.name,
                                symbol: newStrategy.symbol,
                                strategy_type: newStrategy.type,
                                parameters: {}
                            })}
                            className="btn-primary"
                        >
                            Create Strategy
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies?.map((strategy) => (
                    <div key={strategy.id} className={`stat-card relative overflow-hidden ${strategy.active ? 'border-primary/50' : 'opacity-70'}`}>
                        {strategy.active && (
                            <div className="absolute top-0 right-0 p-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
                                Active
                            </div>
                        )}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${strategy.active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{strategy.name}</h3>
                                    <span className="text-xs font-medium text-muted-foreground uppercase">{strategy.symbol} • {strategy.strategy_type}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => deleteMutation.mutate(strategy.id)}
                                    className="p-2 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Status</span>
                                <span className={`font-medium ${strategy.active ? 'text-green-500' : 'text-yellow-500'}`}>
                                    {strategy.active ? 'Running' : 'Paused'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => toggleMutation.mutate(strategy)}
                                className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${strategy.active
                                    ? 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    }`}
                            >
                                {strategy.active ? (
                                    <><Pause className="w-4 h-4" /> Stop</>
                                ) : (
                                    <><Play className="w-4 h-4" /> Start</>
                                )}
                            </button>
                        </div>
                    </div>
                ))}

                {strategies?.length === 0 && !isAddingMode && (
                    <div className="col-span-full py-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center">
                        <div className="bg-muted p-4 rounded-full mb-4">
                            <Activity className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">No active phases</h3>
                        <p className="text-muted-foreground max-w-xs mx-auto mb-6">You haven't added any trading strategies yet. Start by creating your first automated phase.</p>
                        <button
                            onClick={() => setIsAddingMode(true)}
                            className="btn-secondary"
                        >
                            Add Your First Strategy
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
};
