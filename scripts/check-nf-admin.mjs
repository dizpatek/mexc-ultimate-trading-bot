import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

async function checkAdmin() {
    const pool = new Pool({ connectionString });
    try {
        const res = await pool.query("SELECT id, username, email FROM users WHERE id = 1 OR email = 'admin@example.com' OR username = 'admin';");
        console.log("Found Users:", JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Query Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkAdmin();
