// Matrix Pro Bridge V3.0 - Background Service Worker
// Handles cookie management, Google OAuth, and message passing

// Storage keys
const STORAGE_KEYS = {
    TV_COOKIES: 'tv_cookies',
    TV_LOGIN_STATUS: 'tv_login_status',
    TV_USER_INFO: 'tv_user_info',
    LOGIN_WINDOW_ID: 'loginWindowId'
};

let aesKey = null;
let aesKeyPromise = null;
let dbPromise = null;

/**
 * Key storage for session data encryption.
 * We store the CryptoKey non-extractably in IndexedDB to protect it from 
 * being exported even if local storage is accessed.
 */
async function getDb() {
    if (dbPromise) return dbPromise;
    
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('MatrixBridgeKeyDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys');
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => {
            dbPromise = null; // Don't cache failed connection
            reject(e.target.error);
        };
    });
    
    return dbPromise;
}

async function getOrGenerateKey() {
    if (aesKey) return aesKey;
    if (aesKeyPromise) return aesKeyPromise;
    
    aesKeyPromise = (async () => {
        try {
            const db = await getDb();
            const key = await new Promise((resolve, reject) => {
                const tx = db.transaction('keys', 'readonly');
                const store = tx.objectStore('keys');
                const req = store.get('aes_key');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            if (key) {
                aesKey = key;
                return aesKey;
            }
        } catch (err) {
            console.warn('[Matrix Bridge] Error reading key from IDB', err);
        }
        
        // No key found, generate new one
        try {
            const newKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false, // non-extractable!
                ['encrypt', 'decrypt']
            );
            
            const db = await getDb();
            const tx = db.transaction('keys', 'readwrite');
            const store = tx.objectStore('keys');
            await new Promise((resolve, reject) => {
                const req = store.put(newKey, 'aes_key');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
            
            aesKey = newKey;
            return aesKey;
        } catch (err) {
            console.error('[Matrix Bridge] Fatal error generating/saving key:', err);
            throw err;
        }
    })();
    
    // Safety: Reset promise on failure so next caller can retry
    aesKeyPromise.catch(() => {
        aesKeyPromise = null;
    });
    
    return aesKeyPromise;
}

async function encryptData(data) {
    if (!data) return data;
    try {
        const key = await getOrGenerateKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key, encodedData
        );
        
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        // Use Hex encoding to safely represent bytes
        return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('[Matrix Bridge] Encryption failed:', error.message);
        throw error; // Fail-fast so saveSession knows it failed
    }
}

function detectAndDecode(data) {
    if (!data || typeof data !== 'string') return { type: 'raw', value: data };
    
    // Hex check (from current version)
    if (data.length >= 24 && /^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
        const bytes = new Uint8Array(data.length / 2);
        for (let i = 0; i < data.length; i += 2) {
            bytes[i / 2] = parseInt(data.substring(i, i + 2), 16);
        }
        return { type: 'cipher', value: bytes }; // Combined IV + Ciphertext
    }
    
    // Strict Base64 check (for legacy btoa encoded data)
    if (data.length >= 16 && data.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        try {
            const binaryStr = atob(data);
            const bytes = new Uint8Array(binaryStr.length);
            for(let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            return { type: 'cipher', value: bytes };
        } catch { /* malformed base64 */ }
    }
    
    return { type: 'unknown', value: data };
}

async function decryptData(data) {
    if (!data) return data;
    if (typeof data !== 'string') return data;
    
    const decoded = detectAndDecode(data);
    
    try {
        const key = await getOrGenerateKey();
        
        if (decoded.type === 'cipher') {
            const iv = decoded.value.slice(0, 12);
            const encrypted = decoded.value.slice(12);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key, encrypted
            );
            
            return JSON.parse(new TextDecoder().decode(decrypted));
        }
        
        // Not a cipher format, attempt direct JSON parse
        return JSON.parse(data);
    } catch (error) {
        console.warn('[Matrix Bridge] Decryption failed:', error.message);
        try { return JSON.parse(data); } catch { return null; }
    }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Verify sender ID is the extension itself
    if (sender.id !== chrome.runtime.id) {
        console.warn('[Matrix Bridge] Ignored message from untrusted sender:', sender.id);
        return false;
    }

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

/**
 * Specialized cookie setter to handle TradingView domain quirks
 */
async function setCookieInternal(cookie) {
    const isHostOnly = cookie.name.startsWith('__Host-');
    const cookieDomain = cookie.domain || 'www.tradingview.com';
    // Strip leading dot for the URL host part
    const urlHost = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
    
    const path = cookie.path || '/';
    const url = `https://${urlHost}${path}`;
    
    const config = {
        url: url,
        name: cookie.name,
        value: cookie.value,
        path: path,
        secure: true,
        httpOnly: cookie.httpOnly || false,
        sameSite: 'no_restriction',
        expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 86400 * 365
    };

    if (!isHostOnly && cookie.domain && cookie.domain.startsWith('.')) {
        config.domain = cookie.domain;
    }
    
    return chrome.cookies.set(config);
}

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
            const cookiesRaw = data[STORAGE_KEYS.TV_COOKIES];
            const userInfoRaw = data[STORAGE_KEYS.TV_USER_INFO];
            
            const cookies = typeof cookiesRaw === 'string' ? await decryptData(cookiesRaw) : cookiesRaw;
            const userInfo = typeof userInfoRaw === 'string' ? await decryptData(userInfoRaw) : userInfoRaw;
            
            if (!cookies) {
                console.warn('[Matrix Bridge] Could not restore session: decryption failed or data missing');
                return { success: true, restored: false };
            }

            // Restore cookies to TradingView in parallel for performance
            await Promise.all(cookies.map(cookie => 
                setCookieInternal(cookie).catch(e => 
                    console.error('[Matrix Bridge] Error restoring cookie:', cookie.name, e)
                )
            ));
            
            return {
                success: true,
                restored: true,
                isLoggedIn: data[STORAGE_KEYS.TV_LOGIN_STATUS],
                userInfo: userInfo,
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
        // Only store minimum necessary authentication tokens to mitigate storage risks
        const essentialCookies = ['sessionid', 'auth_token', 'device_token', 'tv_ecuid', 'sessionid_sign', 'sp'];
        const filteredCookies = cookies ? cookies.filter(c => essentialCookies.includes(c.name)) : [];

        // encryptData will throw if it fails now
        const encryptedCookies = await encryptData(filteredCookies);
        const encryptedUserInfo = await encryptData(userInfo);

        await chrome.storage.local.set({
            [STORAGE_KEYS.TV_COOKIES]: encryptedCookies,
            [STORAGE_KEYS.TV_LOGIN_STATUS]: true,
            [STORAGE_KEYS.TV_USER_INFO]: encryptedUserInfo
        });
        
        console.log('[Matrix Bridge] Session saved');
        return { success: true };
    } catch (error) {
        console.error('[Matrix Bridge] Error saving session:', error.message);
        return { success: false, error: error.message };
    }
}

// Get all TradingView cookies
async function getTradingViewCookies() {
    try {
        // Query all cookies on tradingview.com and its subdomains
        const cookies = await chrome.cookies.getAll({ domain: 'tradingview.com' });
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
        
        console.log('[Matrix Bridge] Found', cookies.length, 'TradingView cookies for .tradingview.com');
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
        // Use domain instead of URL to ensure we check both .tradingview.com and www.tradingview.com
        const cookies = await chrome.cookies.getAll({ domain: 'tradingview.com' });
        
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const deviceToken = cookies.find(c => c.name === 'device_token');
        const authToken = cookies.find(c => c.name === 'auth_token');
        
        const isLoggedIn = !!(sessionCookie || authToken);
        
        console.log('[Matrix Bridge] Login check:', { isLoggedIn, cookieCount: cookies.length });
        
        // Check stored session first
        const stored = await chrome.storage.local.get([
            STORAGE_KEYS.TV_LOGIN_STATUS,
            STORAGE_KEYS.TV_USER_INFO
        ]);
        
        // Get user info if logged in
        let userInfoRaw = stored[STORAGE_KEYS.TV_USER_INFO] || null;
        let userInfo = typeof userInfoRaw === 'string' ? await decryptData(userInfoRaw) : userInfoRaw;
        
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
                        [STORAGE_KEYS.TV_USER_INFO]: await encryptData(userInfo)
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
        // Set cookies in parallel
        await Promise.all(cookies.map(cookie => setCookieInternal(cookie)));
        
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
        
        // Safely strip sensitive data from the broadcast
        const safeData = data ? JSON.parse(JSON.stringify(data)) : data;
        if (safeData) {
            // Remove cookies and sensitive user identity from broadcasts
            if (safeData.cookies) delete safeData.cookies;
            if (safeData.userInfo) {
                // Keep only non-sensitive UI-related info if needed, or remove entirely
                delete safeData.userInfo; 
            }
        }

        for (const tab of tabs) {
            if (tab.url && (tab.url.startsWith('http://localhost') || tab.url.startsWith('http://127.0.0.1') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('https://www.tradingview.com'))) {
                chrome.tabs.sendMessage(tab.id, { action, data: safeData, source: 'matrix-bridge-extension' }).catch(() => {
                    // Tab might not have content script loaded
                });
            }
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
                await setCookieInternal(cookie);
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
