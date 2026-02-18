"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { HorizonLayout } from '@/components/matrix-horizon/HorizonLayout';
import { Save, ArrowLeft, Key, RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react';
import { setTradingModeClient, getTradingModeSync } from '@/lib/mexc-wrapper';
import { updateTradingMode } from '@/app/actions/trading-mode';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { User, BotConfig } from '@/lib/db';
import type { TradingMode } from '@/lib/mexc-wrapper';

export default function SettingsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [mode, setMode] = useState('test');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    // Admin States
    const [users, setUsers] = useState<User[]>([]);
    const [globalConfig, setGlobalConfig] = useState<BotConfig>({
        id: 1,
        f4_length: 10,
        whale_multiplier: 1.8,
        ai_threshold: 65,
        auto_trade: false,
        defense_mode: false,
        timeframe: '4h',
        updated_at: Date.now()
    });
    const [adminLoading, setAdminLoading] = useState(false);
    const [globalConfigLoaded, setGlobalConfigLoaded] = useState(false);
    const [showConfigSuccess, setShowConfigSuccess] = useState(false);

    const fetchAdminData = useCallback(async () => {
        try {
            const [usersRes, configRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/system')
            ]);
            setUsers(usersRes.data.users);
            if (configRes.data.config) {
                setGlobalConfig(configRes.data.config);
                setGlobalConfigLoaded(true);
            }
        } catch (err) {
            console.error('Failed to fetch admin data', err);
        }
    }, []);

    useEffect(() => {
        setMode(getTradingModeSync());
        if (user?.id === 1) {
            fetchAdminData();
        }
    }, [user, fetchAdminData]);

    const toggleMode = async (m: string) => {
        const newMode = m as TradingMode;
        
        // 1. Client-side update (local storage, cookies)
        setTradingModeClient(newMode);
        
        // 2. Server-side update (database)
        if (user?.id) {
            await updateTradingMode(newMode, user.id);
        }

        setMode(m);
        window.location.reload();
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user? All their data will be purged.')) return;
        try {
            await api.delete(`/admin/users?id=${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Delete failed:', message);
            alert('Failed to delete user');
        }
    };

    const handleUpdateConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminLoading(true);
        try {
            const res = await api.post('/admin/system', globalConfig);
            if (res.data.success) {
                setShowConfigSuccess(true);
                setTimeout(() => setShowConfigSuccess(false), 3000);
            } else {
                alert(`❌ Failed: ${res.data.error || 'Server error'}`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Config update failed:', message);
            alert(`❌ Failed to update global config: ${message}`);
        } finally {
            setAdminLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey || !apiSecret) return alert('Fill all fields');
        setSaving(true);
        try {
            await api.post('/settings/keys', { apiKey, apiSecret });
            alert('✅ API Keys updated.');
            setApiKey(''); setApiSecret('');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('Save keys failed:', message);
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
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            alert('❌ Reset failed: ' + message);
        } finally {
            setResetting(false);
        }
    };

    return (
        <HorizonLayout>
            <Header />
            <main className="flex-1 px-4 py-8 max-w-full overflow-y-auto no-scrollbar">

                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="btn-outline flex items-center gap-2 !px-4 !py-2 bg-white/5 border-white/10"
                    >
                        <ArrowLeft className="w-5 h-5 text-primary" />
                        <span className="font-bold">BACK</span>
                    </button>
                    <h1 className="text-3xl font-black italic tracking-tighter">SETTINGS</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                    {/* Module 1: Active Environment */}
                    <div className="stat-card border-primary/20 h-full">
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

                    {/* Module 2: API Keys */}
                    <div className="stat-card h-full">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 underline decoration-primary underline-offset-8">
                            <Key className="w-5 h-5 text-yellow-500" /> API Keys
                        </h2>
                        <form onSubmit={handleSave} className="space-y-4">
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

                    {/* Module 3: Danger Zone */}
                    <div className="stat-card bg-red-500/[0.03] border-red-500/20 h-full">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-extrabold text-red-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> DANGER ZONE</h3>
                        </div>
                        <p className="text-xs text-muted-foreground italic mb-4">Restores $100,000 USDT balance and deletes all simulation history.</p>
                        <button
                            onClick={handleReset}
                            disabled={resetting}
                            className="w-full bg-red-500 hover:bg-red-600 px-6 py-3 rounded-xl font-bold text-xs uppercase transition-all shadow-lg shadow-red-500/10"
                        >
                            {resetting ? 'Resetting...' : 'Reset Simulator'}
                        </button>
                    </div>

                    {/* Admin Modules */}
                    {user?.id === 1 && (
                        <>
                             {/* User List Management - Fits in 1 col */}
                            <div className="stat-card border-primary/10 h-full">
                                <h3 className="text-sm font-black mb-6 uppercase tracking-widest text-primary/70">Intelligence Units</h3>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                                    {users.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all">
                                            <div>
                                                <p className="font-bold text-xs tracking-tight">{u.username.toUpperCase()}</p>
                                                <p className="text-[9px] text-muted-foreground font-mono">{u.email}</p>
                                            </div>
                                            {u.id !== 1 && (
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="text-[9px] font-black text-red-500/50 hover:text-red-500 transition-colors uppercase"
                                                >
                                                    KILL
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Global Config Management - Spans full width on mobile, but fits in remaining space or new row on large screens.
                                Let's make it col-span-full so it's a wide strip at the bottom (or top if we reordered).
                                Or, better yet, make it span 4 cols (full row) to keep the "horizontal strip" look for controls.
                             */}
                            <div className="stat-card border-blue-500/20 col-span-1 md:col-span-2 lg:col-span-4 mt-0">
                                <div className="flex items-center gap-4 mb-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">Core Engine Parameters</h3>
                                    {showConfigSuccess && (
                                        <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-300">
                                            ✓ Settings Saved
                                        </div>
                                    )}
                                </div>
                                <form onSubmit={handleUpdateConfig} className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-6 gap-4 items-end">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase ml-1">F4 Length</label>
                                        <input 
                                            type="number" 
                                            value={globalConfig.f4_length ?? 10} 
                                            onChange={(e) => setGlobalConfig({...globalConfig, f4_length: parseInt(e.target.value) || 0})}
                                            className="input-field w-full text-xs h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase ml-1">Whale Mul</label>
                                        <input 
                                            type="number" step="0.1" 
                                            value={globalConfig.whale_multiplier ?? 1.8} 
                                            onChange={(e) => {
                                                const val = e.target.value.replace(',', '.');
                                                setGlobalConfig({...globalConfig, whale_multiplier: parseFloat(val) || 0});
                                            }}
                                            className="input-field w-full text-xs h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase ml-1">AI Thresh</label>
                                        <input 
                                            type="number" 
                                            value={globalConfig.ai_threshold ?? 65} 
                                            onChange={(e) => setGlobalConfig({...globalConfig, ai_threshold: parseInt(e.target.value) || 0})}
                                            className="input-field w-full text-xs h-9"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase ml-1">Timeframe</label>
                                        <input 
                                            type="text" 
                                            value={globalConfig.timeframe ?? ''} 
                                            onChange={(e) => setGlobalConfig({...globalConfig, timeframe: e.target.value})}
                                            className="input-field w-full text-xs h-9"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center h-9 pb-1">
                                        <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={!!globalConfig.defense_mode}
                                                onChange={e => setGlobalConfig({ ...globalConfig, defense_mode: e.target.checked })}
                                                className="w-3.5 h-3.5 rounded border-white/10 bg-black/50 checked:bg-rose-500 transition-colors"
                                            />
                                            <span className="text-[10px] font-bold text-muted-foreground group-hover:text-rose-400 transition-colors uppercase">DEFENSE MODE</span>
                                        </label>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={adminLoading || !globalConfigLoaded}
                                        className="h-9 btn-primary !bg-blue-600 hover:!bg-blue-550 border-blue-400/30 flex items-center justify-center gap-2 text-[10px]"
                                    >
                                        {adminLoading ? <RefreshCw className="animate-spin w-3 h-3" /> : <Save className="w-3 h-3" />}
                                        {globalConfigLoaded ? 'UPDATE' : '...'}
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </HorizonLayout>
    );
}
