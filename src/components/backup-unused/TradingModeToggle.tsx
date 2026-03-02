"use client";

import { useState, useEffect, useCallback } from 'react';
import { TestTube, Shield, AlertTriangle, Settings as SettingsIcon, RotateCcw, RefreshCw } from 'lucide-react';
import { getTradingModeSync, setTradingModeClient, type TradingMode } from '@/lib/mexc-wrapper';
import { getSimulator, resetSimulator } from '@/lib/trading-simulator';

export function TradingModeToggle() {
    const [mode, setMode] = useState<TradingMode>('test');
    const [showConfirm, setShowConfirm] = useState(false);
    const [simulatorBalance, setSimulatorBalance] = useState<number>(0);
    const [isResetting, setIsResetting] = useState(false);
    const [pendingReset, setPendingReset] = useState(false);

    const updateSimulatorBalance = useCallback(async () => {
        try {
            const simulator = getSimulator();
            const accountInfo = simulator.getAccountInfo();
            const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
            if (usdtBalance) {
                setSimulatorBalance(parseFloat(usdtBalance.free));
            }
        } catch (error) {
            console.error('Failed to get simulator balance:', error);
        }
    }, []);

    useEffect(() => {
        const syncMode = () => {
            const currentMode = getTradingModeSync();
            setMode(currentMode);
            if (currentMode === 'test') {
                updateSimulatorBalance();
            }
        };

        // Initial sync
        syncMode();

        // Listen for changes
        window.addEventListener('tradingModeChanged', syncMode);
        window.addEventListener('storage', (e) => {
            if (e.key === 'TRADING_MODE') syncMode();
        });

        return () => {
            window.removeEventListener('tradingModeChanged', syncMode);
            window.removeEventListener('storage', syncMode);
        };
    }, [updateSimulatorBalance]);

    const handleModeChange = (newMode: TradingMode) => {
        setTradingModeClient(newMode);
        setMode(newMode);
        if (newMode === 'test') {
            updateSimulatorBalance();
        }
    };

    const confirmProductionMode = () => {
        setTradingModeClient('production');
        setMode('production');
        setShowConfirm(false);
    };

    const handleResetSimulator = async () => {
        setIsResetting(true);
        setPendingReset(false);
        try {
            const response = await fetch('/api/portfolio/reset-simulator', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                // Also reset client-side instance
                resetSimulator();
                await updateSimulatorBalance();
                window.dispatchEvent(new Event('portfolioReset'));
                alert('Simülatör başarıyla sıfırlandı: $100,000 USDT bakiye yüklendi.');
            } else {
                alert(`Hata: ${data.error || 'Sıfırlanamadı'}`);
            }
        } catch (error) {
            console.error('Failed to reset simulator:', error);
            alert('Bağlantı hatası: Sunucuya ulaşılamadı.');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="portfolio-container p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Trading Mode</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${mode === 'test'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    }`}>
                    {mode === 'test' ? '🧪 TEST MODE' : '⚡ LIVE TRADING'}
                </div>
            </div>

            <div className="space-y-4">
                {/* Mode Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleModeChange('test')}
                        className={`p-4 rounded-lg border-2 transition-all ${mode === 'test'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-border hover:border-blue-500/50'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <TestTube className="h-5 w-5 text-blue-500" />
                            <span className="font-semibold">Test Mode</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Simulated trading with virtual funds. Safe for testing strategies.
                        </p>
                    </button>

                    <button
                        onClick={() => handleModeChange('production')}
                        className={`p-4 rounded-lg border-2 transition-all ${mode === 'production'
                                ? 'border-red-500 bg-red-500/10'
                                : 'border-border hover:border-red-500/50'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-red-500" />
                            <span className="font-semibold">Production Mode</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Real trading with actual funds. Use with caution!
                        </p>
                    </button>
                </div>

                {/* Test Mode Info */}
                {mode === 'test' && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                        <div className="flex items-start gap-3">
                            <TestTube className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-blue-400 mb-2">Test Mode Active</h3>
                                <div className="space-y-2 text-xs text-blue-100">
                                    <p>• Simulated portfolio balance: <strong>${simulatorBalance.toLocaleString()}</strong></p>
                                    <p>• All trades are simulated</p>
                                    <p>• Real market prices are used</p>
                                    <p>• No actual funds at risk</p>
                                </div>
                                <div className="mt-4 relative">
                                    {!pendingReset ? (
                                        <button
                                            onClick={() => setPendingReset(true)}
                                            disabled={isResetting}
                                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-xs font-medium transition-colors flex items-center gap-2"
                                        >
                                            {isResetting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                            {isResetting ? 'Resetting...' : 'Reset Simulator'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 p-2 bg-slate-900 border border-red-500/30 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                                            <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest mr-2">Reset All Data?</span>
                                            <button 
                                                onClick={handleResetSimulator}
                                                className="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase transition-all"
                                            >
                                                Confirm ✓
                                            </button>
                                            <button 
                                                onClick={() => setPendingReset(false)}
                                                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase transition-all"
                                            >
                                                Cancel ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Production Mode Warning */}
                {mode === 'production' && (
                    <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ Production Mode Active</h3>
                                <div className="space-y-2 text-xs text-red-100">
                                    <p><strong>WARNING:</strong> All trades will execute with real funds!</p>
                                    <p>• Trades are irreversible</p>
                                    <p>• Real money is at risk</p>
                                    <p>• Double-check all orders</p>
                                    <p>• Use stop-loss protection</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-background border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-semibold text-red-500 mb-2">
                                    Enable Production Trading?
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    You are about to enable <strong>LIVE TRADING</strong> with real funds.
                                    All trades will execute on your actual MEXC account.
                                </p>
                                <div className="bg-red-500/10 border border-red-500/50 rounded p-3 mb-4">
                                    <p className="text-xs text-red-100">
                                        <strong>⚠️ Important:</strong> Make sure you understand the risks.
                                        Test your strategies in Test Mode first.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmProductionMode}
                                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors font-medium"
                            >
                                Enable Production
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
