import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const DOMAIN = "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

async function verifyIsolation() {
    console.log("--- MOD İZOLASYON DOĞRULAMASI ---");
    
    try {
        // Test 1: Production isteği gönder (Uygulama TEST modundayken)
        console.log("[Test 1] Production isteği gönderiliyor (Beklenen: BLOCKED)...");
        const res = await axios.get(`${DOMAIN}/api/cron/strategies?tradingMode=production`, {
            headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
        });
        
        console.log("Yanıt Mesajı:", res.data.message);
        if (res.data.message && res.data.message.includes("blocked")) {
            console.log("✅ BAŞARILI: Production isteği engellendi.");
        } else {
            console.log("❌ HATALI: İsteğe izin verildi!");
        }

        // Test 2: Test isteği gönder
        console.log("\n[Test 2] Test isteği gönderiliyor (Beklenen: SUCCESS)...");
        const res2 = await axios.get(`${DOMAIN}/api/cron/strategies?tradingMode=test`, {
            headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
        });
        console.log("Yanıt Durumu:", res2.status === 200 ? "SUCCESS" : "FAILED");

    } catch (err) {
        console.error("Doğrulama hatası:", err.response?.data || err.message);
    }
}

verifyIsolation();
