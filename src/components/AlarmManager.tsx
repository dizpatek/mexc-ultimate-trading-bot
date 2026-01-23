"use client";

import { useState } from 'react';
import { Bell, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useHoldings } from '../hooks/usePortfolio';

interface Alarm {
    id: number;
    symbol: string;
    condition_type: string;
    action_type: string;
    is_active: boolean;
}

export const AlarmManager = () => {
    const queryClient = useQueryClient();
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [newAlarm, setNewAlarm] = useState({
        symbol: 'BTCUSDT',
        condition_type: 'SELL_SIGNAL',
        action_type: 'NOTIFY'
    });

    const { data: holdings } = useHoldings();

    const { data: alarms, isLoading } = useQuery<Alarm[]>({
        queryKey: ['alarms'],
        queryFn: async () => {
            if (typeof window === 'undefined') return [];
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/alarms', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        enabled: typeof window !== 'undefined'
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            if (typeof window === 'undefined') return;
            const token = localStorage.getItem('token');
            return axios.post('/api/alarms', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alarms'] });
            setIsAddingMode(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            if (typeof window === 'undefined') return;
            const token = localStorage.getItem('token');
            return axios.delete(`/api/alarms?id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alarms'] });
        }
    });

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Bell className="w-6 h-6" /> Automated Alarms
                    </h2>
                    <p className="text-muted-foreground">Configure triggers for automatic actions based on F4 signals.</p>
                </div>
                <button
                    onClick={() => setIsAddingMode(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Alarm
                </button>
            </div>

            {isAddingMode && (
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6 animate-in fade-in zoom-in-95">
                    <h3 className="text-lg font-semibold mb-4">Create New Alarm trigger</h3>
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-semibold text-muted-foreground">Asset</label>
                            <select
                                className="input-field"
                                value={newAlarm.symbol}
                                onChange={e => setNewAlarm({ ...newAlarm, symbol: e.target.value })}
                            >
                                {holdings && holdings.length > 0 ? (
                                    holdings.map((h: any) => (
                                        <option key={h.symbol} value={`${h.symbol}USDT`}>
                                            {h.symbol}/USDT
                                        </option>
                                    ))
                                ) : (
                                    <>
                                        <option value="BTCUSDT">BTC/USDT</option>
                                        <option value="ETHUSDT">ETH/USDT</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase font-semibold text-muted-foreground">Condition</label>
                            <select
                                className="input-field"
                                value={newAlarm.condition_type}
                                onChange={e => setNewAlarm({ ...newAlarm, condition_type: e.target.value })}
                            >
                                <option value="SELL_SIGNAL">F4 SELL Signal</option>
                                <option value="BUY_SIGNAL">F4 BUY Signal</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase font-semibold text-muted-foreground">Action</label>
                            <select
                                className="input-field"
                                value={newAlarm.action_type}
                                onChange={e => setNewAlarm({ ...newAlarm, action_type: e.target.value })}
                            >
                                <option value="NOTIFY">🔔 Notify Only</option>
                                <option value="TRADE">⚡ Auto-Trade (Bot)</option>
                                <option value="PANIC_SELL">🚨 Panic Sell (Liquidate)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAddingMode(false)} className="btn-outline">Cancel</button>
                        <button
                            onClick={() => createMutation.mutate(newAlarm)}
                            className="btn-primary"
                        >
                            Create Alarm
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading alarms...</div>
                ) : alarms?.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                        <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-medium">No active alarms</h3>
                        <p className="text-muted-foreground text-sm">Create an alarm to monitor markets 24/7.</p>
                    </div>
                ) : (
                    alarms?.map((alarm) => (
                        <div key={alarm.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full ${alarm.action_type === 'PANIC_SELL' ? 'bg-red-500/20 text-red-500' :
                                    alarm.action_type === 'TRADE' ? 'bg-blue-500/20 text-blue-500' :
                                        'bg-primary/20 text-primary'
                                    }`}>
                                    {alarm.action_type === 'PANIC_SELL' ? <AlertTriangle className="w-5 h-5" /> :
                                        alarm.action_type === 'TRADE' ? <Zap className="w-5 h-5" /> :
                                            <Bell className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h4 className="font-bold flex items-center gap-2">
                                        {alarm.symbol}
                                        <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-muted rounded">
                                            {alarm.condition_type?.replace('_', ' ')}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        Action: {alarm.action_type}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => deleteMutation.mutate(alarm.id)}
                                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};
