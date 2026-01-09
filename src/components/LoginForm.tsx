"use client";

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Wallet, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login, register } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let success = false;
            if (isLogin) {
                success = await login(email, password);
            } else {
                success = await register(username, email, password);
            }

            if (!success) {
                setError(isLogin ? 'Geçersiz e-posta veya şifre' : 'Kayıt başarısız oldu');
            }
        } catch (err) {
            setError('Bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />

            <div className="max-w-md w-full mx-4 py-12">
                <div className="stat-card backdrop-blur-md bg-card/80 border-primary/20 p-8 shadow-2xl relative">
                    <div className="flex flex-col items-center mb-10">
                        <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-lg shadow-primary/20 mb-6">
                            <Wallet className="w-10 h-10" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">MEXC Ultimate</h1>
                        <p className="text-muted-foreground mt-2 text-center">
                            {isLogin
                                ? 'Yatırımlarınızı yönetmek için giriş yapın'
                                : 'Yeni bir hesap oluşturarak otomasyona başlayın'}
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Kullanıcı Adı</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        className="input-field w-full pl-10 focus:ring-primary/50"
                                        placeholder="Kullanıcı adınız"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">E-posta</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="input-field w-full pl-10 focus:ring-primary/50"
                                    placeholder="ornek@mail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Şifre</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="input-field w-full pl-10 focus:ring-primary/50"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`btn-primary w-full py-3 flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/20 ${loading ? 'opacity-80' : 'hover:scale-[1.02] active:scale-[0.98]'} transition-all duration-200`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Bağlanılıyor...
                                </>
                            ) : (
                                <>
                                    {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>

                        <div className="pt-4 text-center">
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium border-b border-transparent hover:border-primary pb-0.5"
                            >
                                {isLogin
                                    ? 'Hesabınız yok mu? Hemen kayıt olun'
                                    : 'Zaten bir hesabınız var mı? Giriş yapın'}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-8">
                    &copy; 2026 MexC Ultimate Trading Bot. Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
};

export default LoginForm;
