// Native Node 18+ Fetch kullanılıyor.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DOMAIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"; // Aynı konteyner içi yerel ağ
const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

console.log(`[Worker] Otopilot Background Worker Başlatıldı. Hedef: ${DOMAIN}`);

async function pingCron(endpoint) {
    try {
        const url = `${DOMAIN}${endpoint}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (res.ok) {
            console.log(`[Worker] ${endpoint} başarıyla tetiklendi. Status: ${res.status}`);
        } else {
            const errText = await res.text();
            console.error(`[Worker] Hata (${endpoint}): ${res.status} - ${errText}`);
        }
    } catch (err) {
        console.error(`[Worker] ${endpoint} ulaşılamadı:`, err.message);
    }
}

// 1. Otopilot (Strategies) - Her 90 saniyede bir (Her iki mod için)
setInterval(() => {
    pingCron("/api/cron/strategies?immediate=true&tradingMode=test");
    pingCron("/api/cron/strategies?immediate=true&tradingMode=production");
}, 90000);

// 2. Trailing Stop & Profit Monitor - Her 45 saniyede bir (Daha güvenli döngü)
setInterval(() => {
    pingCron("/api/cron/trailing-stop?tradingMode=test");
    pingCron("/api/cron/trailing-stop?tradingMode=production");
}, 45000);

// 3. Alarmlar (Alarms) - Her 15 dakikada bir (Daha sıkı kontrol)
setInterval(() => {
    pingCron("/api/cron/alarms");
}, 15 * 60000);

// 3. Fiyat Geçmişi (Price History) - Her Saat Başı
setInterval(() => {
    pingCron("/api/cron/price-history");
}, 60 * 60000);

// 4. Portföy Özeti (Portfolio Snapshot) - Günde Bir (24 Saat)
setInterval(() => {
    pingCron("/api/cron/portfolio-snapshot");
}, 24 * 60 * 60000);

// Script başlar başlamaz ilk tetikleri ateşle (ısınma - warmup)
setTimeout(() => {
    pingCron("/api/cron/alarms");
    pingCron("/api/cron/strategies?immediate=true&tradingMode=test");
    pingCron("/api/cron/strategies?immediate=true&tradingMode=production");
}, 5000);
