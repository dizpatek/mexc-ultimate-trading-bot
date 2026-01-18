"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Save, AlertTriangle, CheckCircle, XCircle, RefreshCw, Key } from 'lucide-react';

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [health, setHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
    const [error, setError] = useState<string | null>(null);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);

    // Form state
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');

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
                else setError(null);
            } else {
                setError(data.error || 'Failed to load settings');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
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
                if (data.warning) {
                    setError(data.warning); // It's a warning, but we show it in error box for visibility
                } else {
                    // Clear inputs on success for security
                    setApiKey('');
                    setApiSecret('');
                    // Refresh view
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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Settings</h1>
                    <p className="text-muted-foreground">Manage your API connections and system preferences.</p>
                </div>

                {/* API Health Status Card */}
                <div className="portfolio-container p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                            MEXC API Connection
                        </h2>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 
                            ${health === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                                health === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                            {health === 'ok' && <CheckCircle className="h-4 w-4" />}
                            {health === 'error' && <XCircle className="h-4 w-4" />}
                            {health === 'unknown' && <AlertTriangle className="h-4 w-4" />}
                            <span className="uppercase">{health}</span>
                        </div>
                    </div>

                    {maskedKey ? (
                        <div className="text-sm text-muted-foreground mb-2">
                            Active Key: <code className="bg-muted px-2 py-1 rounded">{maskedKey}</code>
                        </div>
                    ) : (
                        <div className="text-sm text-yellow-500 mb-2 font-medium">
                            No API keys found. System running in MOCK mode.
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* API Key Form */}
                <div className="portfolio-container p-6">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Update API Credentails
                    </h2>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">MEXC API Key</label>
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="input-field w-full"
                                placeholder="mx0..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">MEXC API Secret</label>
                            <input
                                type="password"
                                value={apiSecret}
                                onChange={(e) => setApiSecret(e.target.value)}
                                className="input-field w-full"
                                placeholder="Double click to paste..."
                                required
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Verifying & Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Save & Connect
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-muted-foreground mt-4 text-center">
                                Keys are encrypted and stored safely.
                                Providing new keys will overwrite existing ones.
                            </p>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
