// Matrix Pro Bridge V3.0 - Bypass Script
// Runs in MAIN world to override window properties
(function() {
    'use strict';
    
    try {
        const isTV = window.location.hostname.includes('tradingview.com');
        const isIframe = window.self !== window.top;
        
        if (isTV && isIframe) {
            console.log('[Matrix Bridge Bypass] Activating iframe bypass...');
            
            // Mask frame element
            try {
                Object.defineProperty(window, 'frameElement', { 
                    get: () => null,
                    configurable: true 
                });
            } catch {}
            
            // Allow top/parent access but return self
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
            
            // Block X-Frame-Options related redirects
            try {
                const originalSetHref = Object.getOwnPropertyDescriptor(window.location, 'href')?.set;
                if (originalSetHref) {
                    Object.defineProperty(window.location, 'href', {
                        set: function(url) {
                            if (url && (url.includes('expired') || url.includes('error') || url.includes('x-frame'))) {
                                console.log('[Matrix Bridge Bypass] Blocked redirect:', url);
                                return;
                            }
                            originalSetHref.call(window.location, url);
                        },
                        configurable: true
                    });
                }
            } catch {}
        }

        // Google SignIn interceptor
        if (isTV && !isIframe) {
            const checkGoogleButtons = setInterval(() => {
                const googleButtons = document.querySelectorAll('[data-google-signin], .google-signin, [onclick*="google"]');
                googleButtons.forEach(btn => {
                    if (btn.dataset.matrixEnhanced) return;
                    btn.dataset.matrixEnhanced = 'true';
                    btn.addEventListener('click', () => {
                        window.postMessage({
                            source: 'matrix-bridge-extension',
                            action: 'googleLoginClicked',
                            url: window.location.href
                        }, '*');
                    }, true);
                });
            }, 500);
            setTimeout(() => clearInterval(checkGoogleButtons), 10000);
        }

    } catch (e) {
        console.error('[Matrix Bridge Bypass] Error:', e);
    }
})();
