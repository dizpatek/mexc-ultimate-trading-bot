"use client";

import { useEffect, useState, memo, useCallback, useRef } from 'react';
import { Activity, Globe, LogIn, Cookie, RefreshCw, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

// Type definitions
interface LoginStatus {
    isLoggedIn: boolean;
    email?: string;
    cookies?: { name: string; value: string }[];
    userInfo?: {
        id?: number;
        username?: string;
        email?: string;
    };
}

interface ExtensionMessage {
    source: string;
    action: string;
    data?: LoginStatus;
}

// Local storage keys
const LOGIN_STORAGE_KEY = 'tv_login_status';
const WEB_MODE_STORAGE_KEY = 'tv_web_mode';

declare global {
    interface Window {
        TradingView?: {
            widget: new (config: Record<string, unknown>) => void;
        };
        chrome?: {
            runtime?: {
                sendMessage?: (message: unknown, callback?: (response: unknown) => void) => void;
                id?: string;
            };
        };
    }
}

// Helper function to load stored login status
function loadStoredLoginStatus(): LoginStatus | null {
    if (typeof window === 'undefined') return null;
    try {
        const storedStatus = localStorage.getItem(LOGIN_STORAGE_KEY);
        if (storedStatus) {
            const parsed = JSON.parse(storedStatus);
            if (parsed.isLoggedIn) {
                console.log('[PortfolioChart] Restored login status from storage');
                return parsed;
            }
        }
    } catch (e) {
        console.error('[PortfolioChart] Error parsing stored login status:', e);
    }
    return null;
}

function TradingViewWidget() {
    const containerId = 'tv-widget-portfolio-chart';
    
    // Load initial states from localStorage
    const [isWebMode, setIsWebMode] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(WEB_MODE_STORAGE_KEY) === 'true';
    });
    
    const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(loadStoredLoginStatus);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [extensionInstalled, setExtensionInstalled] = useState(false);
    const [extensionChecked, setExtensionChecked] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    
    // Use refs for callbacks to avoid hoisting issues
    const extensionInstalledRef = useRef(extensionInstalled);
    
    // Update ref in effect
    useEffect(() => {
        extensionInstalledRef.current = extensionInstalled;
    }, [extensionInstalled]);

    // Show message helper - defined first to avoid hoisting issues
    const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 5000);
    }, []);

    // Save states to localStorage whenever they change
    useEffect(() => {
        if (loginStatus?.isLoggedIn) {
            localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(loginStatus));
        } else if (loginStatus === null) {
            localStorage.removeItem(LOGIN_STORAGE_KEY);
        }
    }, [loginStatus]);

    useEffect(() => {
        localStorage.setItem(WEB_MODE_STORAGE_KEY, String(isWebMode));
    }, [isWebMode]);

    // Check login status via extension
    const checkLoginStatus = useCallback(() => {
        if (!extensionInstalledRef.current) return;
        
        try {
            // Send message to extension via postMessage
            window.postMessage({
                source: 'matrix-bridge-page',
                action: 'checkLoginStatus'
            }, '*');
        } catch (error) {
            console.error('[PortfolioChart] Error checking login status:', error);
        }
    }, []);

    // Handle messages from extension
    const handleExtensionMessage = useCallback((event: MessageEvent) => {
        const data = event.data as ExtensionMessage;
        if (data && data.source === 'matrix-bridge-extension') {
            console.log('[PortfolioChart] Extension detected:', data.action);
            
            // If we get ANY message from the bridge, it's installed and working
            setExtensionInstalled(true);
            
            const statusData = data.data as LoginStatus | undefined;
            
            switch (data.action) {
                case 'loginComplete':
                case 'checkLoginStatusResponse':
                case 'restoreSessionResponse':
                    if (statusData?.isLoggedIn) {
                        console.log('[PortfolioChart] Session verified:', statusData);
                        setLoginStatus(statusData);
                        setShowLoginModal(false);
                        
                        // New login success
                        if (data.action === 'loginComplete') {
                            setIsWebMode(true);
                            showMessage('TradingView girisi basarili!', 'success');
                        }
                    } else if (data.action === 'checkLoginStatusResponse') {
                        // Only clear if we explicitly asked and it definitively failed
                        // This prevents clearing state during initial load/restoration
                        setLoginStatus(null);
                        localStorage.removeItem(LOGIN_STORAGE_KEY);
                    }
                    break;
                    
                case 'cookieChanged':
                    checkLoginStatus();
                    break;
            }
        }
    }, [checkLoginStatus, showMessage]); // Removed loginStatus from dependencies

    // Check for extension on mount
    useEffect(() => {
        // Listen for messages from extension
        window.addEventListener('message', handleExtensionMessage);
        
        // Initial check
        // Initial discovery: Send a ping and ask for session restore
        const initDiscovery = () => {
            console.log('[PortfolioChart] Searching for Matrix Bridge...');
            window.postMessage({
                source: 'matrix-bridge-page',
                action: 'restoreSession'
            }, '*');
            
            // Set checked to true after a small delay to show missing notice if no reply
            setTimeout(() => setExtensionChecked(true), 2500);
        };

        // Small delay to ensure bridge is ready
        const timer = setTimeout(initDiscovery, 1000);
        
        return () => {
            window.removeEventListener('message', handleExtensionMessage);
            clearTimeout(timer);
        };
    }, [handleExtensionMessage]);

    // Initialize TradingView widget
    useEffect(() => {
        if (isWebMode) return;

        let script: HTMLScriptElement | null = null;
        
        const initWidget = () => {
             if (typeof window.TradingView !== 'undefined') {
                new window.TradingView.widget({
                    autosize: true,
                    symbol: "MEXC:BTCUSDT",
                    interval: "60",
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "tr",
                    toolbar_bg: "#f1f3f6",
                    enable_publishing: true, 
                    allow_symbol_change: true,
                    container_id: containerId,
                    hide_side_toolbar: false,
                    save_image: true,
                    details: true,
                    hotlist: true,
                    calendar: true,
                    show_popup_button: true,
                    popup_width: "1000",
                    popup_height: "650",
                    withdateranges: true,
                    studies: [
                        "RSI@tv-basicstudies",
                        "MACD@tv-basicstudies",
                        "StochasticRSI@tv-basicstudies"
                    ],
                    overrides: {
                        "paneProperties.background": "#020617",
                        "paneProperties.vertGridProperties.color": "#1e293b",
                        "paneProperties.horzGridProperties.color": "#1e293b",
                        "scalesProperties.textColor": "#94a3b8",
                        "mainSeriesProperties.candleStyle.upColor": "#10b981",
                        "mainSeriesProperties.candleStyle.downColor": "#f43f5e",
                        "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
                        "mainSeriesProperties.candleStyle.borderDownColor": "#f43f5e",
                        "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
                        "mainSeriesProperties.candleStyle.wickDownColor": "#f43f5e"
                    }
                });
             }
        };

        if (!document.getElementById('tv-widget-script')) {
            script = document.createElement('script');
            script.id = 'tv-widget-script';
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = initWidget;
            document.head.appendChild(script);
        } else {
            if (window.TradingView) {
                initWidget();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.TradingView) {
                        clearInterval(checkInterval);
                        initWidget();
                    }
                }, 100);
                return () => clearInterval(checkInterval);
            }
        }
    }, [isWebMode]);

    // Check login status after popup closes
    const checkLoginAfterPopup = useCallback(async () => {
        // Wait a bit for cookies to be set
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if extension has stored session
        if (extensionInstalledRef.current) {
            window.postMessage({
                source: 'matrix-bridge-page',
                action: 'checkLoginStatus'
            }, '*');
        }
        
        showMessage('Giris tamamlandi. Web modu etkinlestiriliyor...', 'info');
        setShowLoginModal(false);
        
        // Assume login was successful and switch to web mode
        setLoginStatus({ isLoggedIn: true });
        setIsWebMode(true);
    }, [showMessage]);

    // Handle web mode toggle
    const handleWebModeToggle = useCallback(() => {
        if (!isWebMode) {
            // Switching to web mode - check if logged in first
            if (!loginStatus?.isLoggedIn) {
                setShowLoginModal(true);
                return;
            }
        }
        setIsWebMode(!isWebMode);
    }, [isWebMode, loginStatus?.isLoggedIn]);

    // Open login popup via extension
    const handleLogin = useCallback(async () => {
        setIsLoading(true);
        setMessage(null);
        
        try {
            // Open TradingView login in a popup window
            const loginUrl = 'https://www.tradingview.com/accounts/signin/?legacy_signup=true#/signin';
            
            // Open popup
            const popup = window.open(
                loginUrl,
                'TradingViewLogin',
                'width=500,height=700,scrollbars=yes,resizable=yes'
            );
            
            if (popup) {
                showMessage('Giris penceresi acildi. Lutfen Google hesabinizi secin ve giris yapin.', 'info');
                
                // Monitor popup for completion
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        setIsLoading(false);
                        // Check if login was successful by trying to access TradingView
                        checkLoginAfterPopup();
                    }
                }, 500);
            } else {
                showMessage('Popup engellendi. Lutfen popup engelleyiciyi devre disi birakin.', 'error');
                setIsLoading(false);
            }
        } catch (error) {
            console.error('[PortfolioChart] Login error:', error);
            showMessage('Giris sirasinda hata olustu.', 'error');
            setIsLoading(false);
        }
    }, [showMessage, checkLoginAfterPopup]);

    // Open TradingView directly
    const openProChart = useCallback(() => {
        window.open('https://www.tradingview.com/chart/?symbol=MEXC:BTCUSDT', '_blank');
    }, []);

    // Close login modal
    const closeLoginModal = useCallback(() => {
        setShowLoginModal(false);
    }, []);

    // Continue without login
    const continueWithoutLogin = useCallback(() => {
        setShowLoginModal(false);
        setIsWebMode(true);
    }, []);

    // Logout
    const handleLogout = useCallback(() => {
        setLoginStatus(null);
        setIsWebMode(false);
        localStorage.removeItem(LOGIN_STORAGE_KEY);
        showMessage('Cikis yapildi.', 'info');
    }, [showMessage]);

    return (
        <div className="h-full w-full flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Header/Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 z-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Pro Chart V3</span>
                        {extensionChecked && !extensionInstalled && (
                            <div 
                                onClick={() => setShowLoginModal(true)}
                                className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-black rounded cursor-pointer hover:bg-rose-500/20 transition-all animate-pulse"
                            >
                                <AlertCircle className="w-3 h-3" />
                                <span>@ [.matrix-extension] BULUNAMADI</span>
                            </div>
                        )}
                        {extensionInstalled && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black rounded">
                                <CheckCircle className="w-3 h-3" />
                                <span>BRIDGE AKTIF</span>
                            </div>
                        )}
                    </div>

                    {/* Notification Pill */}
                    {message && (
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold animate-in fade-in slide-in-from-left-2 duration-300 ${
                            message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                            message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                            {message.type === 'success' && <CheckCircle className="w-3 h-3" />}
                            {message.type === 'error' && <AlertCircle className="w-3 h-3" />}
                            {message.type === 'info' && <RefreshCw className="w-3 h-3 animate-spin" />}
                            <span>{message.text}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Cookies Status */}
                    {loginStatus?.isLoggedIn && (
                        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded border border-slate-700/50 text-[10px] text-slate-400 font-medium">
                            <Cookie className="w-3 h-3 text-purple-400" />
                            <span>{loginStatus.cookies?.length || 0} Veri</span>
                        </div>
                    )}

                    <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleWebModeToggle}
                            className={`group h-8 px-3 rounded flex items-center gap-2 transition-all border text-[10px] font-bold ${
                                isWebMode 
                                    ? 'bg-purple-600/10 text-purple-400 border-purple-500/30 hover:bg-purple-600/20' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                            }`}
                        >
                            {isWebMode ? <Activity className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                            <span>{isWebMode ? "Widget Moduna Don" : "Web Modunu Ac"}</span>
                        </button>

                        <button 
                            onClick={openProChart}
                            className="h-8 w-8 rounded flex items-center justify-center bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 transition-all"
                            title="Yeni Sekmede Aç"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>

                        {loginStatus?.isLoggedIn ? (
                            <button
                                onClick={handleLogout}
                                className="h-8 px-3 rounded flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all text-[10px] font-bold"
                            >
                                <LogIn className="w-3.5 h-3.5 rotate-180" />
                                <span className="hidden sm:inline">Çıkış</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowLoginModal(true)}
                                className="h-8 px-3 rounded flex items-center gap-2 bg-green-600/10 text-green-500 border border-green-500/20 hover:bg-green-600/20 transition-all text-[10px] font-bold"
                            >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Giriş Yap</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 w-full bg-[#020617] relative overflow-hidden">
                {isWebMode ? (
                    <iframe 
                        src="https://www.tradingview.com/chart/?symbol=MEXC:BTCUSDT&theme=dark"
                        className="w-full h-full border-0"
                        allowFullScreen
                        title="TradingView Pro Web"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
                    />
                ) : (
                    <div id={containerId} className="h-full w-full" />
                )}

                {/* Overlays */}
                {isWebMode && !loginStatus?.isLoggedIn && (
                    <div className="absolute bottom-4 left-4 right-4 animate-in fade-in slide-in-from-bottom-4 duration-500 z-40">
                        <div className="px-4 py-3 bg-slate-900/95 border border-yellow-500/30 text-slate-300 rounded-xl shadow-2xl backdrop-blur-md">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-yellow-400 mb-1">Oturum Açılmadı</p>
                                    <p className="text-[10px] leading-relaxed opacity-80">
                                        TradingView kısıtlı çalışabilir. Tam erişim için{' '}
                                        <button onClick={() => setShowLoginModal(true)} className="text-yellow-400 underline hover:no-underline font-bold">Giriş Yapın</button>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
            
            {/* Login Modal */}
            {showLoginModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
                                <LogIn className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">TradingView Bağlantısı</h3>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Web Modu Entegrasyonu</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Profesyonel web arayüzüne tam erişim için TradingView hesabınızla güvenli bir şekilde oturum açmalısınız.
                            </p>
                            
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="shrink-0 mt-0.5">
                                        {!extensionInstalled ? (
                                            <AlertCircle className="w-5 h-5 text-rose-500" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5 text-blue-500" />
                                        )}
                                    </div>
                                    <div className="text-xs leading-relaxed">
                                        {!extensionInstalled ? (
                                            <>
                                                <p className="font-bold text-rose-400 mb-1">Eklenti Gerekli!</p>
                                                <p className="text-slate-400 mb-3">TradingView oturumunu senkronize etmek için Matrix Bridge eklentisi yüklü olmalıdır.</p>
                                                <a 
                                                    href="/matrix-extension-v3.zip" 
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all font-bold"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                    EKLENTIYI INDIR (.ZIP)
                                                </a>
                                                <div className="mt-3 p-2 bg-black/40 rounded border border-white/5 text-[10px] text-slate-500">
                                                    <p className="font-bold mb-1">NASIL KURULUR?</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        <li>Zip dosyasını çıkarın.</li>
                                                        <li>Chrome/Edge: <span className="text-slate-300">Ayarlar {">"} Uzantılar</span> açın.</li>
                                                        <li><span className="text-slate-300">Geliştirici Modu</span>&apos;nu açın.</li>
                                                        <li><span className="text-slate-300">Paketlenmiş öğe yükle</span> diyerek klasörü seçin.</li>
                                                    </ol>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="font-bold text-blue-400 mb-1">Akıllı Oturum Yönetimi</p>
                                                <p className="text-blue-100/70">Bridge eklentisi aktif. Giriş yaptıktan sonra oturumunuz otomatik korunacaktır.</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleLogin}
                                    disabled={isLoading}
                                    className={`flex-1 h-12 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg ${
                                        isLoading ? 'bg-slate-800' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                                    }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Bağlanıyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-5 h-5" />
                                            <span>Giriş Panelini Aç</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={closeLoginModal}
                                    className="px-6 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-xl transition-all border border-slate-700"
                                >
                                    İptal
                                </button>
                            </div>
                            
                            <div className="text-center pt-2">
                                <button
                                    onClick={continueWithoutLogin}
                                    className="text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-all uppercase tracking-widest"
                                >
                                    Misafir Modunda Devam Et
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export const PortfolioChart = memo(TradingViewWidget);
