// Matrix Pro Bridge V3.3 - Bypass Script
// Only for TradingView
(function() {
    'use strict';
    
    const isTV = window.location.hostname.includes('tradingview.com');
    const isIframe = window.self !== window.top;
    
    if (isTV && isIframe) {
        try {
            Object.defineProperty(window, 'frameElement', { 
                get: () => null,
                configurable: true 
            });
        } catch {}
        
        try {
            Object.defineProperty(window, 'top', { 
                get: () => window,
                configurable: true 
            });
            Object.defineProperty(window, 'parent', { 
                get: () => window,
                configurable: true 
            });
        } catch {}
        
        try {
            const orig = Object.getOwnPropertyDescriptor(window.location, 'href')?.set;
            if (orig) {
                Object.defineProperty(window.location, 'href', {
                    set: function(url) {
                        if (url && (url.includes('x-frame') || url.includes('blocked'))) return;
                        orig.call(window.location, url);
                    },
                    configurable: true
                });
            }
        } catch {}
    }

    // Google SignIn for TradingView
    if (isTV && !isIframe) {
        const check = setInterval(() => {
            document.querySelectorAll('[data-google-signin]').forEach(btn => {
                if (!btn.dataset.matrixDone) {
                    btn.dataset.matrixDone = 'true';
                    btn.addEventListener('click', () => {
                        window.postMessage({ source: 'matrix-bridge-extension', action: 'googleLoginClicked' }, '*');
                    }, true);
                }
            });
        }, 500);
        setTimeout(() => clearInterval(check), 10000);
    }
})();
