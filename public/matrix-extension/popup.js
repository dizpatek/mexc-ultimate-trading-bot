// Matrix Pro Bridge V3.4 - Popup Script
// Simplified: No Google account management (isolation)
document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    const tvStatusEl = document.getElementById('tv-status');
    const accountInfoEl = document.getElementById('account-info');
    const tvEmailEl = document.getElementById('tv-email');
    const cookieCountEl = document.getElementById('cookie-count');
    const messageEl = document.getElementById('message');
    
    const btnLogin = document.getElementById('btn-login');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnClear = document.getElementById('btn-clear');
    
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    
    await refreshStatus();
    
    btnLogin.addEventListener('click', handleLogin);
    btnRefresh.addEventListener('click', refreshStatus);
    btnClear.addEventListener('click', clearCookies);
    
    async function refreshStatus() {
        try {
            loadingEl.classList.remove('hidden');
            contentEl.classList.add('hidden');
            
            const tvStatus = await sendMessage({ action: 'checkLoginStatus' });
            const tvCookies = await sendMessage({ action: 'getTradingViewCookies' });
            
            updateTVStatus(tvStatus);
            updateCookieCount(tvCookies);
            
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');
        } catch (error) {
            console.error('Error refreshing status:', error);
            showMessage('Durum yenilenirken hata oluştu: ' + error.message, 'error');
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');
        }
    }
    
    function updateTVStatus(status) {
        if (status.success && status.isLoggedIn) {
            tvStatusEl.textContent = 'Giriş Yapıldı ✓';
            tvStatusEl.className = 'status-value logged-in';
            
            if (status.userInfo && (status.userInfo.email || status.userInfo.username)) {
                tvEmailEl.textContent = status.userInfo.email || status.userInfo.username;
                accountInfoEl.classList.remove('hidden');
            } else {
                accountInfoEl.classList.add('hidden');
            }
            
            btnLogin.textContent = '✓ Zaten Giriş Yapıldı';
            btnLogin.disabled = true;
        } else {
            tvStatusEl.textContent = 'Giriş Yapılmadı ✗';
            tvStatusEl.className = 'status-value logged-out';
            accountInfoEl.classList.add('hidden');
            
            btnLogin.textContent = '🔑 TradingView\'a Giriş Yap';
            btnLogin.disabled = false;
        }
    }
    
    function updateCookieCount(cookiesResult) {
        if (cookiesResult.success) {
            cookieCountEl.textContent = cookiesResult.cookieCount || cookiesResult.cookies?.length || 0;
        } else {
            cookieCountEl.textContent = '?';
        }
    }
    
    async function handleLogin() {
        try {
            btnLogin.disabled = true;
            btnLogin.textContent = '⏳ Giriş penceresi açılıyor...';
            
            const result = await sendMessage({ action: 'openLoginPopup' });
            
            if (result.success) {
                showMessage('Giriş penceresi açıldı. Lütfen hesabınızı seçin.', 'success');
                pollLoginStatus();
            } else {
                showMessage('Giriş penceresi açılamadı: ' + result.error, 'error');
                btnLogin.disabled = false;
                btnLogin.textContent = '🔑 TradingView\'a Giriş Yap';
            }
        } catch (error) {
            showMessage('Giriş hatası: ' + error.message, 'error');
            btnLogin.disabled = false;
            btnLogin.textContent = '🔑 TradingView\'a Giriş Yap';
        }
    }
    
    async function pollLoginStatus() {
        let attempts = 0;
        const maxAttempts = 60;
        
        const poll = async () => {
            attempts++;
            
            const status = await sendMessage({ action: 'checkLoginStatus' });
            
            if (status.success && status.isLoggedIn) {
                showMessage('Giriş başarılı! ✓', 'success');
                await refreshStatus();
                return;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(poll, 1000);
            } else {
                showMessage('Giriş zaman aşımına uğradı. Lütfen tekrar deneyin.', 'error');
                btnLogin.disabled = false;
                btnLogin.textContent = '🔑 TradingView\'a Giriş Yap';
            }
        };
        
        poll();
    }
    
    async function clearCookies() {
        try {
            btnClear.disabled = true;
            btnClear.textContent = '⏳ Temizleniyor...';
            
            const result = await sendMessage({ action: 'clearCookies' });
            
            if (result.success) {
                showMessage(`${result.cleared} TV cookie temizlendi.`, 'success');
                await refreshStatus();
            } else {
                showMessage('Cookie temizleme hatası: ' + result.error, 'error');
            }
        } catch (error) {
            showMessage('Temizleme hatası: ' + error.message, 'error');
        } finally {
            btnClear.disabled = false;
            btnClear.textContent = '🗑️ TV Cookieleri Temizle';
        }
    }
    
    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `message message-${type}`;
        messageEl.classList.remove('hidden');
        
        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }
    
    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
});
