import pkg from 'pg';
const { Pool } = pkg;

const connectionString = "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:5432/_169a43476a1c";

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
