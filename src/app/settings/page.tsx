"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Save, ArrowLeft, Key, Lock, RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react';
import { setTradingMode, getTradingMode } from '@/lib/mexc-wrapper';
import { api } from '@/services/api';

export default function SettingsPage() {
    const router = useRouter();
    const [mode, setMode] = useState('test');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        setMode(getTradingMode());
    }, []);

    const toggleMode = (m: string) => {
        setTradingMode(m as any);
        setMode(m);
        window.location.reload();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey || !apiSecret) return alert('Fill all fields');
        setSaving(true);
        try {
            await api.post('/settings/keys', { apiKey, apiSecret });
            alert('✅ API Keys updated.');
            setApiKey(''); setApiSecret('');
        } catch (err) {
            alert('❌ Connection failed.');
        } finally { setSaving(false); }
    };

    const handleReset = async () => {
        if (!confirm('DANGER: This will wipe all test data and reset balance to $100,000. Continue?')) return;
        setResetting(true);
        try {
            const res = await api.post('/portfolio/reset-simulator');
            if (res.data.success) {
                alert('✅ Simulator reset successful!');
                window.location.href = '/';
            } else {
                throw new Error(res.data.error || 'Server error');
            }
        } catch (e: any) {
            alert('❌ Reset failed: ' + (e.response?.data?.error || e.message));
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            <Header />
            <main className="container mx-auto px-4 py-12 max-w-3xl">

                <div className="flex items-center justify-between mb-12">
                    <button
                        onClick={() => router.push('/')}
                        className="btn-outline flex items-center gap-2 !px-4 !py-2 bg-white/5 border-white/10"
                    >
                        <ArrowLeft className="w-5 h-5 text-primary" />
                        <span className="font-bold">BACK</span>
                    </button>
                    <h1 className="text-3xl font-black italic tracking-tighter">SETTINGS</h1>
                </div>

                <div className="space-y-8">
                    <div className="stat-card border-primary/20">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-primary" /> Active environment
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => toggleMode('test')}
                                className={`p-4 rounded-xl border-2 transition-all font-bold ${mode === 'test' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                            > TEST (SIM) </button>
                            <button
                                onClick={() => toggleMode('production')}
                                className={`p-4 rounded-xl border-2 transition-all font-bold ${mode === 'production' ? 'border-red-500 bg-red-500/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                            > PRODUCTION </button>
                        </div>
                    </div>

                    <div className="stat-card">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 underline decoration-primary underline-offset-8">
                            <Key className="w-5 h-5 text-yellow-500" /> API Keys
                        </h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <input
                                type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                                className="input-field w-full text-sm font-mono" placeholder="API Key"
                            />
                            <input
                                type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                                className="input-field w-full text-sm font-mono" placeholder="API Secret"
                            />
                            <button
                                type="submit" disabled={saving}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw className="animate-spin" /> : <Save />}
                                SAVE KEYS
                            </button>
                        </form>
                    </div>

                    <div className="stat-card bg-red-500/[0.03] border-red-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-extrabold text-red-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> DANGER ZONE</h3>
                            <button
                                onClick={handleReset}
                                disabled={resetting}
                                className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-xl font-bold text-xs uppercase transition-all shadow-lg shadow-red-500/10"
                            >
                                {resetting ? 'Resetting...' : 'Reset Simulator'}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground italic">Restores $100,000 USDT balance and deletes all simulation history.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
