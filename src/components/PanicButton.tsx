"use client";

import { useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, X, Loader2 } from 'lucide-react';
import { api } from '@/services/api';

export const PanicButton = () => {
    const [showSellModal, setShowSellModal] = useState(false);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSellAll = async () => {
        setLoading(true);
        try {
            const response = await api.post('/panic/sell-all');
            setResult(response.data);
            setTimeout(() => {
                setShowSellModal(false);
                setResult(null);
            }, 5000);
        } catch (error: any) {
            setResult({ error: true, message: error.response?.data?.message || 'Sell failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleBuyBack = async () => {
        setLoading(true);
        try {
            const response = await api.post('/panic/buy-back');
            setResult(response.data);
            setTimeout(() => {
                setShowBuyModal(false);
                setResult(null);
            }, 5000);
        } catch (error: any) {
            setResult({ error: true, message: error.response?.data?.message || 'Buy back failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <button
                    onClick={() => setShowSellModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                    <TrendingDown className="w-4 h-4" />
                    SELL ALL
                </button>
                <button
                    onClick={() => setShowBuyModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                    <TrendingUp className="w-4 h-4" />
                    BUY BACK
                </button>
            </div>

            {/* Sell All Modal */}
            {showSellModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Panic Sell Confirmation</h3>
                                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                                </div>
                            </div>
                            <button onClick={() => setShowSellModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {result ? (
                            <div className={`p-4 rounded-lg ${result.error ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                <p className="font-medium">{result.message || result.error}</p>
                                {result.totalUsdtValue && (
                                    <p className="text-sm mt-2">Total USDT: ${result.totalUsdtValue.toFixed(2)}</p>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                                    <p className="text-sm">
                                        This will sell <strong>ALL</strong> your assets (except USDT/USDC) and convert them to USDT.
                                        A snapshot will be saved so you can buy them back later.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSellModal(false)}
                                        className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSellAll}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Selling...
                                            </>
                                        ) : (
                                            'Confirm Sell All'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Buy Back Modal */}
            {showBuyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <TrendingUp className="w-6 h-6 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Buy Back Confirmation</h3>
                                    <p className="text-sm text-muted-foreground">Restore your portfolio</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBuyModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {result ? (
                            <div className={`p-4 rounded-lg ${result.error ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                <p className="font-medium">{result.message || result.error}</p>
                                {result.totalSpent && (
                                    <p className="text-sm mt-2">Total Spent: ${result.totalSpent.toFixed(2)}</p>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                                    <p className="text-sm">
                                        This will buy back all assets from your most recent panic sell snapshot.
                                        Current market prices will be used.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowBuyModal(false)}
                                        className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleBuyBack}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Buying...
                                            </>
                                        ) : (
                                            'Confirm Buy Back'
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
