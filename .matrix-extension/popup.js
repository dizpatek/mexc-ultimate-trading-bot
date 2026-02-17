// Matrix Pro Bridge V3.0 - Popup Script
document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    const tvStatusEl = document.getElementById('tv-status');
    const accountInfoEl = document.getElementById('account-info');
    const tvEmailEl = document.getElementById('tv-email');
    const cookieCountEl = document.getElementById('cookie-count');
    const googleAccountsEl = document.getElementById('google-accounts');
    const messageEl = document.getElementById('message');
    
    const btnLogin = document.getElementById('btn-login');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnClear = document.getElementById('btn-clear');
    
    // Show loading
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    
    // Initialize
    await refreshStatus();
    
    // Event listeners
    btnLogin.addEventListener('click', handleLogin);
    btnRefresh.addEventListener('click', refreshStatus);
    btnClear.addEventListener('click', clearCookies);
    
    async function refreshStatus() {
        try {
            loadingEl.classList.remove('hidden');
            contentEl.classList.add('hidden');
            
            // Check TradingView login status
            const tvStatus = await sendMessage({ action: 'checkLoginStatus' });
            
            // Get TradingView cookies
            const tvCookies = await sendMessage({ action: 'getTradingViewCookies' });
            
            // Get Google accounts
            const googleAccounts = await sendMessage({ action: 'getGoogleAccounts' });
            
            // Update UI
            updateTVStatus(tvStatus);
            updateCookieCount(tvCookies);
            updateGoogleAccounts(googleAccounts);
            
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
            
            if (status.userInfo && status.userInfo.email) {
                tvEmailEl.textContent = status.userInfo.email;
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
            cookieCountEl.textContent = cookiesResult.cookies.length;
        } else {
            cookieCountEl.textContent = '?';
        }
    }
    
    function updateGoogleAccounts(accountsResult) {
        googleAccountsEl.innerHTML = '';
        
        if (accountsResult.success && accountsResult.accounts && accountsResult.accounts.length > 0) {
            accountsResult.accounts.forEach((email, index) => {
                const accountEl = document.createElement('div');
                accountEl.className = 'google-account';
                accountEl.innerHTML = `
                    <div class="google-avatar">${email.charAt(0).toUpperCase()}</div>
                    <span class="google-email">${email}</span>
                `;
                accountEl.addEventListener('click', () => loginWithAccount(index));
                googleAccountsEl.appendChild(accountEl);
            });
        } else if (accountsResult.success && accountsResult.hasGoogleSession) {
            googleAccountsEl.innerHTML = `
                <div class="google-account" id="google-session">
                    <div class="google-avatar">G</div>
                    <span class="google-email">Google Oturumu Mevcut</span>
                </div>
            `;
            document.getElementById('google-session').addEventListener('click', () => loginWithAccount(0));
        } else {
            googleAccountsEl.innerHTML = `
                <div style="padding: 8px; font-size: 11px; color: #666;">
                    Google hesabı bulunamadı. İlk giriş sırasında hesap seçebilirsiniz.
                </div>
            `;
        }
    }
    
    async function handleLogin() {
        try {
            btnLogin.disabled = true;
            btnLogin.textContent = '⏳ Giriş penceresi açılıyor...';
            
            const result = await sendMessage({ action: 'openLoginPopup' });
            
            if (result.success) {
                showMessage('Giriş penceresi açıldı. Lütfen Google hesabınızı seçin.', 'success');
                
                // Poll for login completion
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
    
    async function loginWithAccount(index) {
        try {
            showMessage('Google hesabı ile giriş yapılıyor...', 'success');
            
            const result = await sendMessage({ action: 'loginWithGoogle', accountIndex: index });
            
            if (result.success) {
                pollLoginStatus();
            } else {
                showMessage('Giriş başarısız: ' + result.error, 'error');
            }
        } catch (error) {
            showMessage('Giriş hatası: ' + error.message, 'error');
        }
    }
    
    async function pollLoginStatus() {
        let attempts = 0;
        const maxAttempts = 60; // 1 minute
        
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
                showMessage(`${result.cleared} cookie temizlendi.`, 'success');
                await refreshStatus();
            } else {
                showMessage('Cookie temizleme hatası: ' + result.error, 'error');
            }
        } catch (error) {
            showMessage('Temizleme hatası: ' + error.message, 'error');
        } finally {
            btnClear.disabled = false;
            btnClear.textContent = '🗑️ Cookieleri Temizle';
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
