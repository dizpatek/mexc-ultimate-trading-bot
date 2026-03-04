import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function migrateAdmin() {
    const pool = new Pool({ connectionString });
    try {
        console.log("[Migration] Adding is_admin column to users table...");
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        `);
        console.log("[Migration] Column added/verified.");

        console.log("[Migration] Setting admin privilege for admin@example.com...");
        const res = await pool.query(`
            UPDATE users 
            SET is_admin = TRUE 
            WHERE email = 'admin@example.com' 
            RETURNING id, username, email, is_admin;
        `);
        
        if (res.rowCount > 0) {
            console.log("Updated User:", JSON.stringify(res.rows[0], null, 2));
        } else {
            console.warn("User 'admin@example.com' not found. Please register first or run reset-admin script.");
        }

    } catch (err) {
        console.error("Migration Error:", err.message);
    } finally {
        await pool.end();
    }
}

migrateAdmin();
