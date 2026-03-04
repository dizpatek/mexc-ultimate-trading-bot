import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function checkAdminDuplication() {
    const pool = new Pool({ connectionString });
    try {
        const res = await pool.query("SELECT id, username, email FROM users WHERE email = 'admin@example.com' OR username = 'admin' ORDER BY id ASC;");
        console.log("Found Admin-like Users:", JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkAdminDuplication();
