// Matrix Pro Bridge V3.0 - Bridge Script
// Runs in ISOLATED world to handle extension communication
(function() {
    'use strict';
    
    try {
        const isTV = window.location.hostname.includes('tradingview.com');
        const isIframe = window.self !== window.top;
        
        console.log('[Matrix Bridge] Initializing communication bridge...', { isTV, isIframe, url: window.location.href });

        // 1. Listen for messages from the PAGE (Matrix Dashboard or TradingView Main World)
        window.addEventListener('message', (event) => {
            if (!event.data || !event.data.source) return;

            // Forward messages from PAGE to BACKGROUND
            if (event.data.source === 'matrix-bridge-page') {
                console.log('[Matrix Bridge Bridge] Forwarding to background:', event.data.action);
                chrome.runtime.sendMessage(event.data, (response) => {
                    if (response) {
                        window.postMessage({
                            source: 'matrix-bridge-extension',
                            action: event.data.action + 'Response',
                            data: response
                        }, '*');
                    }
                });
            }

            // Forward messages from BYPASS (Main World) to BACKGROUND
            if (event.data.source === 'matrix-bridge-extension' && event.data.action === 'googleLoginClicked') {
                chrome.runtime.sendMessage(event.data);
            }
            
            // Forward messages from USER DETECTION (Main World logic) if needed
            if (event.data.source === 'matrix-bridge-extension' && event.data.action === 'userLoggedIn') {
                chrome.runtime.sendMessage(event.data);
            }
        });

        // 2. Listen for messages from BACKGROUND to PAGE
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('[Matrix Bridge Bridge] Received from background:', message.action);
            window.postMessage({
                source: 'matrix-bridge-extension',
                action: message.action,
                data: message.data
            }, '*');
            if (sendResponse) sendResponse({ success: true });
        });

        // 3. Login Detection via MutationObserver (Runs in ISOLATED world but can see DOM)
        if (isTV && !isIframe) {
            const initObserver = () => {
                if (!document.body) {
                    setTimeout(initObserver, 100);
                    return;
                }
                
                const observer = new MutationObserver(() => {
                    const userMenu = document.querySelector('[data-name="header-user-menu-button"]');
                    if (userMenu) {
                        console.log('[Matrix Bridge Bridge] Login detected');
                        chrome.runtime.sendMessage({
                            source: 'matrix-bridge-extension',
                            action: 'userLoggedIn',
                            url: window.location.href
                        });
                        observer.disconnect();
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });
            };
            initObserver();
        }

    } catch (e) {
        console.error('[Matrix Bridge Bridge] Error:', e);
    }
})();
