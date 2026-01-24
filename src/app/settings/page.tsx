"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import {
    Save,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    Key,
    Lock,
    ArrowLeft
} from 'lucide-react';
import { TradingModeToggle } from '@/components/TradingModeToggle';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [health, setHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
    const [error, setError] = useState<string | null>(null);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);

    // Form state for API Keys
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings/keys');
            const data = await res.json();
            if (res.ok) {
                setHealth(data.health);
                setMaskedKey(data.apiKeyMasked);
                if (data.error) setError(data.error);
            } else {
                setError(data.error || 'Failed to load settings');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKeys = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, apiSecret }),
            });
            const data = await res.json();
            if (res.ok) {
                setHealth(data.health);
                if (data.warning) setError(data.warning);
                else {
                    setApiKey('');
                    setApiSecret('');
                    fetchSettings();
                }
            } else {
                setError(data.error || 'Failed to save settings');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordMessage(null);
        try {
            const res = await fetch('/api/settings/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
                setCurrentPassword('');
                setNewPassword('');
            } else {
                setPasswordMessage({ type: 'error', text: data.error || 'Failed to update password' });
            }
        } catch (e: any) {
            setPasswordMessage({ type: 'error', text: e.message });
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
                {/* HEAD SECTION WITH BACK BUTTON */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-bold">System Settings</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground uppercase font-bold tracking-widest">API Status:</span>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${health === 'ok' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${health === 'ok' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                            {health.toUpperCase()}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">

                    {/* TRADING MODE */}
                    <div className="stat-card">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Save className="w-5 h-5 text-primary" /> Trading Environment
                        </h3>
                        <TradingModeToggle />
                    </div>

                    {/* API KEYS FORM */}
                    <div className="stat-card">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Key className="h-5 w-5 text-yellow-500" />
                            MEXC API Configuration
                        </h2>

                        {maskedKey && (
                            <div className="mb-6 p-3 bg-muted/50 rounded-lg text-xs font-mono text-muted-foreground border border-border">
                                Active Key: {maskedKey}
                            </div>
                        )}

                        <form onSubmit={handleSaveKeys} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">API Key</label>
                                    <input
                                        type="text"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="input-field w-full"
                                        placeholder="Enter your MEXC API Key"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">API Secret</label>
                                    <input
                                        type="password"
                                        value={apiSecret}
                                        onChange={(e) => setApiSecret(e.target.value)}
                                        className="input-field w-full"
                                        placeholder="Enter your API Secret"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary w-full md:w-auto flex items-center justify-center gap-2 min-w-[200px]"
                                >
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? 'Verifying...' : 'Update API Credentials'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* PASSWORD CHANGE FORM */}
                    <div className="stat-card">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Lock className="h-5 w-5 text-blue-500" />
                            Security & Access
                        </h2>

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Current Password</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="input-field w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="input-field w-full"
                                        placeholder="Min 6 characters"
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </div>

                            {passwordMessage && (
                                <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm ${passwordMessage.type === 'success'
                                        ? 'bg-green-500/10 border-green-500/20 text-green-500'
                                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                                    }`}>
                                    {passwordMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                    {passwordMessage.text}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={savingPassword}
                                    className="btn-outline w-full md:w-auto flex items-center justify-center gap-2 min-w-[200px]"
                                >
                                    {savingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                    {savingPassword ? 'Updating...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
