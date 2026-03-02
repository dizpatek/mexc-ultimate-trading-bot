// Matrix Pro Bridge V3.0 - Background Service Worker
// Handles cookie management, Google OAuth, and message passing

// Storage keys
const STORAGE_KEYS = {
    TV_COOKIES: 'tv_cookies',
    TV_LOGIN_STATUS: 'tv_login_status',
    TV_USER_INFO: 'tv_user_info',
    LOGIN_WINDOW_ID: 'loginWindowId'
};

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Matrix Bridge] Message received:', message.action);
    
    switch (message.action) {
        case 'getTradingViewCookies':
            getTradingViewCookies().then(sendResponse);
            return true;
            
        case 'getGoogleAccounts':
            getGoogleAccounts().then(sendResponse);
            return true;
            
        case 'loginWithGoogle':
            loginWithGoogle(message.accountIndex).then(sendResponse);
            return true;
            
        case 'checkLoginStatus':
            checkTradingViewLoginStatus().then(sendResponse);
            return true;
            
        case 'setTradingViewCookies':
            setTradingViewCookies(message.cookies).then(sendResponse);
            return true;
            
        case 'openLoginPopup':
            openLoginPopup().then(sendResponse);
            return true;
            
        case 'clearCookies':
            clearAllCookies().then(sendResponse);
            return true;
            
        case 'restoreSession':
            restoreSession().then(sendResponse);
            return true;
            
        case 'saveSession':
            saveSession(message.cookies, message.userInfo).then(sendResponse);
            return true;
    }
});

// Restore session from storage
async function restoreSession() {
    try {
        const data = await chrome.storage.local.get([
            STORAGE_KEYS.TV_COOKIES,
            STORAGE_KEYS.TV_LOGIN_STATUS,
            STORAGE_KEYS.TV_USER_INFO
        ]);
        
        if (data[STORAGE_KEYS.TV_COOKIES] && data[STORAGE_KEYS.TV_LOGIN_STATUS]) {
            // Restore cookies to TradingView
            const cookies = data[STORAGE_KEYS.TV_COOKIES];
            for (const cookie of cookies) {
                try {
                    await chrome.cookies.set({
                        url: 'https://www.tradingview.com',
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain || '.tradingview.com',
                        path: cookie.path || '/',
                        secure: cookie.secure !== false,
                        httpOnly: cookie.httpOnly || false,
                        sameSite: cookie.sameSite || 'lax',
                        expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 86400 * 365 // 1 year
                    });
                } catch (e) {
                    console.error('[Matrix Bridge] Error restoring cookie:', cookie.name, e);
                }
            }
            
            return {
                success: true,
                restored: true,
                isLoggedIn: data[STORAGE_KEYS.TV_LOGIN_STATUS],
                userInfo: data[STORAGE_KEYS.TV_USER_INFO],
                cookies: cookies.map(c => ({ name: c.name, value: c.value }))
            };
        }
        
        return { success: true, restored: false };
    } catch (error) {
        console.error('[Matrix Bridge] Error restoring session:', error);
        return { success: false, error: error.message };
    }
}

// Save session to storage
async function saveSession(cookies, userInfo) {
    try {
        await chrome.storage.local.set({
            [STORAGE_KEYS.TV_COOKIES]: cookies,
            [STORAGE_KEYS.TV_LOGIN_STATUS]: true,
            [STORAGE_KEYS.TV_USER_INFO]: userInfo
        });
        
        console.log('[Matrix Bridge] Session saved');
        return { success: true };
    } catch (error) {
        console.error('[Matrix Bridge] Error saving session:', error);
        return { success: false, error: error.message };
    }
}

// Get all TradingView cookies
async function getTradingViewCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ url: 'https://www.tradingview.com' });
        const formattedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite || 'lax',
            expirationDate: cookie.expirationDate
        }));
        
        console.log('[Matrix Bridge] Found', cookies.length, 'TradingView cookies');
        return { success: true, cookies: formattedCookies };
    } catch (error) {
        console.error('[Matrix Bridge] Error getting cookies:', error);
        return { success: false, error: error.message };
    }
}

// Get Google accounts (from cookies)
async function getGoogleAccounts() {
    try {
        const googleCookies = await chrome.cookies.getAll({ domain: '.google.com' });
        
        // Look for account indicators in cookies
        const accountEmails = [];
        
        // Check for GAIA IDs and email in cookies
        for (const cookie of googleCookies) {
            if (cookie.name === 'ACCOUNT_CHOOSER' || cookie.name.includes('LSOLH')) {
                try {
                    const decoded = decodeURIComponent(cookie.value);
                    // Extract email patterns
                    const emailMatch = decoded.match(/[\w.-]+@[\w.-]+\.\w+/g);
                    if (emailMatch) {
                        emailMatch.forEach(email => {
                            if (!accountEmails.includes(email)) {
                                accountEmails.push(email);
                            }
                        });
                    }
                } catch {
                    // Ignore decode errors
                }
            }
        }
        
        // Also check accounts.google.com cookies
        await chrome.cookies.getAll({ domain: 'accounts.google.com' });
        
        console.log('[Matrix Bridge] Found Google accounts:', accountEmails);
        return { success: true, accounts: accountEmails, hasGoogleSession: googleCookies.length > 0 };
    } catch (error) {
        console.error('[Matrix Bridge] Error getting Google accounts:', error);
        return { success: false, error: error.message };
    }
}

// Login with Google - opens popup for account selection
async function loginWithGoogle() {
    try {
        // Open TradingView login page which redirects to Google
        const loginUrl = 'https://www.tradingview.com/accounts/signin/?legacy_signup=true#/signin';
        
        // Create a new window for login
        const window = await chrome.windows.create({
            url: loginUrl,
            type: 'popup',
            width: 500,
            height: 700,
            focused: true
        });
        
        // Store window ID for later
        await chrome.storage.local.set({ [STORAGE_KEYS.LOGIN_WINDOW_ID]: window.id });
        
        return { success: true, windowId: window.id };
    } catch (error) {
        console.error('[Matrix Bridge] Error opening login:', error);
        return { success: false, error: error.message };
    }
}

// Open login popup with Google account chooser
async function openLoginPopup() {
    try {
        // First, get current Google accounts
        const googleResult = await getGoogleAccounts();
        
        // Open TradingView's Google login directly
        const tvLoginUrl = 'https://www.tradingview.com/api/v1/sso/google/?legacy_signup=true';
        
        const window = await chrome.windows.create({
            url: tvLoginUrl,
            type: 'popup',
            width: 500,
            height: 700,
            focused: true
        });
        
        // Monitor the window for completion
        monitorLoginWindow(window.id);
        
        return { success: true, windowId: window.id, accounts: googleResult.accounts };
    } catch (error) {
        console.error('[Matrix Bridge] Error opening login popup:', error);
        return { success: false, error: error.message };
    }
}

// Monitor login window for completion
async function monitorLoginWindow(windowId) {
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            // Check if window still exists
            const window = await chrome.windows.get(windowId).catch(() => null);
            
            if (!window) {
                clearInterval(checkInterval);
                // Window closed, check if login was successful
                const status = await checkTradingViewLoginStatus();
                if (status.isLoggedIn) {
                    // Save session
                    const cookies = await getTradingViewCookies();
                    await saveSession(cookies.cookies, status.userInfo);
                }
                notifyContentScript('loginComplete', status);
                return;
            }
            
            // Check cookies for sessionid (indicates successful login)
            const cookies = await chrome.cookies.getAll({ url: 'https://www.tradingview.com' });
            const sessionCookie = cookies.find(c => c.name === 'sessionid');
            const authToken = cookies.find(c => c.name === 'auth_token');
            
            if (sessionCookie || authToken) {
                // Login successful!
                clearInterval(checkInterval);
                
                // Save session before closing window
                const status = await checkTradingViewLoginStatus();
                const allCookies = await getTradingViewCookies();
                await saveSession(allCookies.cookies, status.userInfo);
                
                await chrome.windows.remove(windowId);
                notifyContentScript('loginComplete', status);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                notifyContentScript('loginTimeout', { success: false, error: 'Login timeout' });
            }
        } catch (error) {
            console.error('[Matrix Bridge] Error monitoring login:', error);
        }
    }, 1000);
}

// Check TradingView login status
async function checkTradingViewLoginStatus() {
    try {
        const cookies = await chrome.cookies.getAll({ url: 'https://www.tradingview.com' });
        
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const deviceToken = cookies.find(c => c.name === 'device_token');
        const authToken = cookies.find(c => c.name === 'auth_token');
        
        const isLoggedIn = !!(sessionCookie || authToken);
        
        // Check stored session first
        const stored = await chrome.storage.local.get([
            STORAGE_KEYS.TV_LOGIN_STATUS,
            STORAGE_KEYS.TV_USER_INFO
        ]);
        
        // Get user info if logged in
        let userInfo = stored[STORAGE_KEYS.TV_USER_INFO] || null;
        
        if (isLoggedIn && !userInfo) {
            try {
                const response = await fetch('https://www.tradingview.com/api/v1/private/accounts/me/', {
                    credentials: 'include'
                });
                if (response.ok) {
                    userInfo = await response.json();
                    // Save to storage
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.TV_LOGIN_STATUS]: true,
                        [STORAGE_KEYS.TV_USER_INFO]: userInfo
                    });
                }
            } catch {
                // Ignore fetch errors
            }
        }
        
        // If logged in, save cookies
        if (isLoggedIn) {
            const allCookies = await getTradingViewCookies();
            await saveSession(allCookies.cookies, userInfo);
        }
        
        return {
            success: true,
            isLoggedIn,
            hasSession: !!sessionCookie,
            hasDeviceToken: !!deviceToken,
            cookies: cookies.map(c => ({ name: c.name, value: c.value })),
            userInfo
        };
    } catch (error) {
        console.error('[Matrix Bridge] Error checking login status:', error);
        return { success: false, error: error.message, isLoggedIn: false };
    }
}

// Set TradingView cookies
async function setTradingViewCookies(cookies) {
    try {
        for (const cookie of cookies) {
            await chrome.cookies.set({
                url: 'https://www.tradingview.com',
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain || '.tradingview.com',
                path: cookie.path || '/',
                secure: true,
                httpOnly: cookie.httpOnly || false,
                sameSite: 'no_restriction',
                expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 86400 * 365
            });
        }
        
        // Save to storage
        await saveSession(cookies, null);
        
        return { success: true };
    } catch (error) {
        console.error('[Matrix Bridge] Error setting cookies:', error);
        return { success: false, error: error.message };
    }
}

// Clear all cookies
async function clearAllCookies() {
    try {
        const tvCookies = await chrome.cookies.getAll({ domain: '.tradingview.com' });
        for (const cookie of tvCookies) {
            // Strip leading dot from domain to form a valid URL
            // e.g. ".tradingview.com" -> "tradingview.com"
            const domainName = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            await chrome.cookies.remove({
                url: `https://${domainName}${cookie.path}`,
                name: cookie.name
            });
        }
        
        // Clear storage
        await chrome.storage.local.remove([
            STORAGE_KEYS.TV_COOKIES,
            STORAGE_KEYS.TV_LOGIN_STATUS,
            STORAGE_KEYS.TV_USER_INFO
        ]);
        
        return { success: true, cleared: tvCookies.length };
    } catch (error) {
        console.error('[Matrix Bridge] Error clearing cookies:', error);
        return { success: false, error: error.message };
    }
}

// Notify content script of events
async function notifyContentScript(action, data) {
    try {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { action, data, source: 'matrix-bridge-extension' }).catch(() => {
                // Tab might not have content script loaded
            });
        }
    } catch (error) {
        console.error('[Matrix Bridge] Error notifying content script:', error);
    }
}

// Listen for cookie changes
chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const { cookie, removed, cause } = changeInfo;
    
    // Ignore deletions or our own modifications to avoid infinite loops
    if (removed || cause === 'overwrite') return;
    
    const domain = cookie.domain;
    const isTV = domain.includes('tradingview.com');
    const isGoogle = domain.includes('google.com');
    
    if (isTV || isGoogle) {
        console.log(`[Matrix Bridge] Cookie detected: ${cookie.name} on ${domain}`);
        
        // Check if cookie already has the correct settings
        if (cookie.sameSite !== 'no_restriction' || !cookie.secure) {
            console.log(`[Matrix Bridge] Fixing cookie attributes for: ${cookie.name}`);
            
            try {
                // Determine the URL for the cookie. 
                // CRITICAL: Since we force secure: true (required for SameSite=None), 
                // the URL MUST be https or the API will fail.
                const domainName = domain.startsWith('.') ? domain.substring(1) : domain;
                const url = `https://${domainName}${cookie.path}`;
                
                // Re-set the cookie with SameSite=None and Secure
                await chrome.cookies.set({
                    url: url,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: true,
                    httpOnly: cookie.httpOnly,
                    sameSite: 'no_restriction',
                    expirationDate: cookie.expirationDate
                });
            } catch (error) {
                // Silently ignore failures for non-critical cookies to reduce console noise
                if (cookie.name === 'sessionid' || cookie.name === 'auth_token' || isGoogle) {
                    console.error(`[Matrix Bridge] Failed to fix critical cookie ${cookie.name}:`, error.message);
                }
            }
        }
        
        // Specific logic for TradingView sessionid/auth_token
        if (isTV && (cookie.name === 'sessionid' || cookie.name === 'auth_token')) {
            const status = await checkTradingViewLoginStatus();
            if (status.isLoggedIn) {
                const cookies = await getTradingViewCookies();
                await saveSession(cookies.cookies, status.userInfo);
                notifyContentScript('loginComplete', status);
            }
        }
    }
});

// Handle window close
chrome.windows.onRemoved.addListener(async (windowId) => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.LOGIN_WINDOW_ID);
    if (data[STORAGE_KEYS.LOGIN_WINDOW_ID] === windowId) {
        // Login window closed, check status
        const status = await checkTradingViewLoginStatus();
        if (status.isLoggedIn) {
            const cookies = await getTradingViewCookies();
            await saveSession(cookies.cookies, status.userInfo);
        }
        notifyContentScript('loginComplete', status);
        await chrome.storage.local.remove(STORAGE_KEYS.LOGIN_WINDOW_ID);
    }
});

// On startup, restore session
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Matrix Bridge] Extension starting up, restoring session...');
    await restoreSession();
});

// On installed
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Matrix Bridge] Extension installed:', details.reason);
    if (details.reason === 'install') {
        // First install
        console.log('[Matrix Bridge] First install, initializing...');
    } else if (details.reason === 'update') {
        // Update - try to restore session
        await restoreSession();
    }
});

console.log('[Matrix Bridge] V3.0 Background Service Worker initialized');
