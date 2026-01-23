"use client";

import { useState } from 'react';
import { X, TrendingDown, Percent, Info } from 'lucide-react';
import { api } from '@/services/api';

interface TrailingStopModalProps {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
    quantity: number;
    currentPrice: number;
}

export const TrailingStopModal = ({ isOpen, onClose, symbol, quantity, currentPrice }: TrailingStopModalProps) => {
    const [callbackRate, setCallbackRate] = useState('2.0');
    const [activationPrice, setActivationPrice] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.post('/trade/trailing-stop', {
                symbol,
                quantity,
                callbackRate: parseFloat(callbackRate),
                activationPrice: activationPrice ? parseFloat(activationPrice) : null
            });
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create trailing stop');
        } finally {
            setLoading(false);
        }
    };

    const stopPrice = currentPrice * (1 - parseFloat(callbackRate || '0') / 100);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Trailing Stop</h3>
                        <p className="text-xs text-muted-foreground">{symbol} • {quantity} Assets</p>
                    </div>
                </div>

                {success ? (
                    <div className="bg-green-500/10 text-green-500 p-4 rounded-lg text-center font-medium">
                        Trailing Stop Activated! 🚀
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Callback Rate (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    max="50"
                                    value={callbackRate}
                                    onChange={(e) => setCallbackRate(e.target.value)}
                                    className="input-field w-full pl-9"
                                    required
                                />
                                <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Sell if price drops <strong>{callbackRate}%</strong> from peak.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                Activation Price <span className="text-muted-foreground font-normal">(Optional)</span>
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={activationPrice}
                                onChange={(e) => setActivationPrice(e.target.value)}
                                className="input-field w-full mb-1"
                                placeholder={`Current: ${currentPrice}`}
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" /> Start tracking only after price hits this level.
                            </p>
                        </div>

                        <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Current Price:</span>
                                <span className="font-mono">${currentPrice.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Initial Stop:</span>
                                <span className="font-mono text-red-500">${stopPrice.toFixed(4)}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !callbackRate}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Activating...' : 'Set Trailing Stop'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
