// Matrix Pro Bridge V3.4 - Background Service Worker
// Handles TradingView cookie management ONLY. Google cookies are NEVER touched.

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
            dbPromise = null;
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
        
        try {
            const newKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
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
        
        return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('[Matrix Bridge] Encryption failed:', error.message);
        throw error;
    }
}

function detectAndDecode(data) {
    if (!data || typeof data !== 'string') return { type: 'raw', value: data };
    
    if (data.length >= 24 && /^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
        const bytes = new Uint8Array(data.length / 2);
        for (let i = 0; i < data.length; i += 2) {
            bytes[i / 2] = parseInt(data.substring(i, i + 2), 16);
        }
        return { type: 'cipher', value: bytes };
    }
    
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
            const cookiesRaw = data[STORAGE_KEYS.TV_COOKIES];
            const userInfoRaw = data[STORAGE_KEYS.TV_USER_INFO];
            
            const cookies = typeof cookiesRaw === 'string' ? await decryptData(cookiesRaw) : cookiesRaw;
            const userInfo = typeof userInfoRaw === 'string' ? await decryptData(userInfoRaw) : userInfoRaw;
            
            if (!cookies) {
                console.warn('[Matrix Bridge] Could not restore session: decryption failed or data missing');
                return { success: true, restored: false };
            }

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
                cookieCount: cookies.length,
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
        const essentialCookies = ['sessionid', 'auth_token', 'device_token', 'tv_ecuid', 'sessionid_sign', 'sp'];
        const filteredCookies = cookies ? cookies.filter(c => essentialCookies.includes(c.name)) : [];

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
        
        console.log('[Matrix Bridge] Found', cookies.length, 'TradingView cookies');
        return { success: true, cookies: formattedCookies, cookieCount: cookies.length };
    } catch (error) {
        console.error('[Matrix Bridge] Error getting cookies:', error);
        return { success: false, error: error.message };
    }
}

// Open login popup
async function openLoginPopup() {
    try {
        const tvLoginUrl = 'https://www.tradingview.com/accounts/signin/?legacy_signup=true#/signin';
        
        const window = await chrome.windows.create({
            url: tvLoginUrl,
            type: 'popup',
            width: 500,
            height: 700,
            focused: true
        });
        
        monitorLoginWindow(window.id);
        
        return { success: true, windowId: window.id };
    } catch (error) {
        console.error('[Matrix Bridge] Error opening login popup:', error);
        return { success: false, error: error.message };
    }
}

// Monitor login window for completion
async function monitorLoginWindow(windowId) {
    let attempts = 0;
    const maxAttempts = 120;
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        try {
            const window = await chrome.windows.get(windowId).catch(() => null);
            
            if (!window) {
                clearInterval(checkInterval);
                const status = await checkTradingViewLoginStatus();
                if (status.isLoggedIn) {
                    const cookies = await getTradingViewCookies();
                    await saveSession(cookies.cookies, status.userInfo);
                }
                notifyContentScript('loginComplete', status);
                return;
            }
            
            const cookies = await chrome.cookies.getAll({ url: 'https://www.tradingview.com' });
            const sessionCookie = cookies.find(c => c.name === 'sessionid');
            const authToken = cookies.find(c => c.name === 'auth_token');
            
            if (sessionCookie || authToken) {
                clearInterval(checkInterval);
                
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
        const cookies = await chrome.cookies.getAll({ domain: 'tradingview.com' });
        
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const deviceToken = cookies.find(c => c.name === 'device_token');
        const authToken = cookies.find(c => c.name === 'auth_token');
        
        const isLoggedIn = !!(sessionCookie || authToken);
        
        console.log('[Matrix Bridge] Login check:', { isLoggedIn, cookieCount: cookies.length });
        
        const stored = await chrome.storage.local.get([
            STORAGE_KEYS.TV_LOGIN_STATUS,
            STORAGE_KEYS.TV_USER_INFO
        ]);
        
        let userInfoRaw = stored[STORAGE_KEYS.TV_USER_INFO] || null;
        let userInfo = typeof userInfoRaw === 'string' ? await decryptData(userInfoRaw) : userInfoRaw;
        
        if (isLoggedIn && !userInfo) {
            try {
                const response = await fetch('https://www.tradingview.com/api/v1/private/accounts/me/', {
                    credentials: 'include'
                });
                if (response.ok) {
                    userInfo = await response.json();
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.TV_LOGIN_STATUS]: true,
                        [STORAGE_KEYS.TV_USER_INFO]: await encryptData(userInfo)
                    });
                }
            } catch {
                // Ignore fetch errors
            }
        }
        
        if (isLoggedIn) {
            const allCookies = await getTradingViewCookies();
            await saveSession(allCookies.cookies, userInfo);
        }
        
        return {
            success: true,
            isLoggedIn,
            hasSession: !!sessionCookie,
            hasDeviceToken: !!deviceToken,
            cookieCount: cookies.length,
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
        await Promise.all(cookies.map(cookie => setCookieInternal(cookie)));
        await saveSession(cookies, null);
        return { success: true };
    } catch (error) {
        console.error('[Matrix Bridge] Error setting cookies:', error);
        return { success: false, error: error.message };
    }
}

// Clear only TradingView cookies — NEVER touch Google cookies
async function clearAllCookies() {
    try {
        const tvCookies = await chrome.cookies.getAll({ domain: '.tradingview.com' });
        for (const cookie of tvCookies) {
            const domainName = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
            await chrome.cookies.remove({
                url: `https://${domainName}${cookie.path}`,
                name: cookie.name
            });
        }
        
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

// Notify content script of events — now includes cookieCount for UI
async function notifyContentScript(action, data) {
    try {
        const tabs = await chrome.tabs.query({});
        
        // Build safe data — keep cookieCount but strip raw cookie values and sensitive info
        const safeData = data ? JSON.parse(JSON.stringify(data)) : data;
        if (safeData) {
            // Keep cookieCount for UI display
            if (safeData.cookies) {
                safeData.cookieCount = safeData.cookies.length;
                delete safeData.cookies;
            }
            if (safeData.userInfo) {
                // Keep only username for display, strip email and other sensitive data
                if (safeData.userInfo.username) {
                    safeData.userInfo = { username: safeData.userInfo.username };
                } else {
                    delete safeData.userInfo;
                }
            }
        }

        for (const tab of tabs) {
            if (tab.url && (
                tab.url.startsWith('http://localhost') || 
                tab.url.startsWith('http://127.0.0.1') || 
                tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('https://www.tradingview.com') ||
                tab.url.includes('.vercel.app')
            )) {
                chrome.tabs.sendMessage(tab.id, { action, data: safeData, source: 'matrix-bridge-extension' }).catch(() => {
                    // Tab might not have content script loaded
                });
            }
        }
    } catch (error) {
        console.error('[Matrix Bridge] Error notifying content script:', error);
    }
}

// Listen for cookie changes — ONLY TradingView cookies, NEVER Google
chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const { cookie, removed, cause } = changeInfo;
    
    // Ignore deletions or our own modifications to avoid infinite loops
    if (removed || cause === 'overwrite') return;
    
    const domain = cookie.domain;
    const isTV = domain.includes('tradingview.com');
    
    // ISOLATION: Only process TradingView cookies, never Google or other domains
    if (!isTV) return;
    
    console.log(`[Matrix Bridge] TV Cookie detected: ${cookie.name} on ${domain}`);
    
    // Fix cookie attributes for cross-origin iframe usage
    if (cookie.sameSite !== 'no_restriction' || !cookie.secure) {
        try {
            await setCookieInternal(cookie);
        } catch (error) {
            if (cookie.name === 'sessionid' || cookie.name === 'auth_token') {
                console.error(`[Matrix Bridge] Failed to fix critical cookie ${cookie.name}:`, error.message);
            }
        }
    }
    
    // Session persistence for auth-related cookies
    if (cookie.name === 'sessionid' || cookie.name === 'auth_token') {
        const status = await checkTradingViewLoginStatus();
        if (status.isLoggedIn) {
            const cookies = await getTradingViewCookies();
            await saveSession(cookies.cookies, status.userInfo);
            notifyContentScript('loginComplete', status);
        }
    }
});

// Handle window close
chrome.windows.onRemoved.addListener(async (windowId) => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.LOGIN_WINDOW_ID);
    if (data[STORAGE_KEYS.LOGIN_WINDOW_ID] === windowId) {
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
        console.log('[Matrix Bridge] First install, initializing...');
    } else if (details.reason === 'update') {
        await restoreSession();
    }
});

console.log('[Matrix Bridge] V3.4 Background Service Worker initialized');
