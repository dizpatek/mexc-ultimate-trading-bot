"use client";

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { sendTradeSignal } from '../services/api';
import type { TradeSignal } from '../services/api';

export const TradeForm = () => {
    const [signal, setSignal] = useState<'buy' | 'sell'>('buy');
    const [pair, setPair] = useState('BTC_USDT');
    const [amount, setAmount] = useState('');
    const [usdt, setUsdt] = useState('');
    const [risk, setRisk] = useState('');
    const [tp, setTp] = useState('');
    const [sl, setSl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const tradeSignal: TradeSignal = {
                signal,
                pair,
                secret: 'replace_with_strong_secret' // This should match your WEBHOOK_SECRET
            };

            if (amount) tradeSignal.amount = parseFloat(amount);
            if (usdt) tradeSignal.usdt = parseFloat(usdt);
            if (risk) tradeSignal.risk = parseFloat(risk);
            if (tp) tradeSignal.tp = tp.split(',').map(Number);
            if (sl) tradeSignal.sl = sl.split(',').map(Number);

            const response = await sendTradeSignal(tradeSignal);

            if (response && (response.success || response.ok)) {
                setMessage({ type: 'success', text: `Trade signal sent successfully` });
                // Reset form
                setAmount('');
                setUsdt('');
                setRisk('');
                setTp('');
                setSl('');
            } else {
                setMessage({ type: 'error', text: 'Failed to send trade signal' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: `Error: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="portfolio-container p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Send Trade Signal</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Signal Type
                        </label>
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                className={`flex-1 py-3 px-4 rounded-md transition-all ${signal === 'buy'
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                        : 'btn-outline'
                                    }`}
                                onClick={() => setSignal('buy')}
                            >
                                Buy
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-3 px-4 rounded-md transition-all ${signal === 'sell'
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'btn-outline'
                                    }`}
                                onClick={() => setSignal('sell')}
                            >
                                Sell
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Trading Pair
                        </label>
                        <input
                            type="text"
                            value={pair}
                            onChange={(e) => setPair(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="e.g., BTC_USDT"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Amount
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="Token amount"
                            step="any"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            USDT Value
                        </label>
                        <input
                            type="number"
                            value={usdt}
                            onChange={(e) => setUsdt(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="USDT value"
                            step="any"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Risk (%)
                        </label>
                        <input
                            type="number"
                            value={risk}
                            onChange={(e) => setRisk(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="Risk percentage"
                            step="0.1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Take Profit Levels
                        </label>
                        <input
                            type="text"
                            value={tp}
                            onChange={(e) => setTp(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="e.g., 1.5,2.0,2.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Stop Loss Levels
                        </label>
                        <input
                            type="text"
                            value={sl}
                            onChange={(e) => setSl(e.target.value)}
                            className="input-field w-full px-4 py-3"
                            placeholder="e.g., 0.8,0.6"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <div>
                        {message && (
                            <div
                                className={`text-sm p-3 rounded-md ${message.type === 'success'
                                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary flex items-center px-6 py-3 shadow-lg shadow-primary/20"
                    >
                        {isLoading ? (
                            <span>Sending...</span>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                <span>Send Signal</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
