import pkg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pkg;

const connectionString = "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require";
const NEW_PASSWORD = "Matrix2026!"; // Yeni şifreniz

async function resetAdminPassword() {
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
        console.log("Admin şifresi sıfırlanıyor...");
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
        
        const result = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = 'snat@bot.com' RETURNING id, username, email",
            [hashedPassword]
        );

        if (result.rows.length > 0) {
            console.log("BAŞARILI! Şifre güncellendi.");
            console.log("Kullanıcı:", result.rows[0]);
            console.log(`Yeni Giriş Şifreniz: ${NEW_PASSWORD}`);
        } else {
            console.error("HATA: 'snat@bot.com' kullanıcısı bulunamadı.");
        }
    } catch (err) {
        console.error("İŞLEM BAŞARISIZ:", err.message);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
