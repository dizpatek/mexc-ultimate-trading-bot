import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function inspectUsers() {
    const pool = new Pool({ connectionString });
    try {
        // Inspect table structure
        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.log("Users Table Schema:", JSON.stringify(columns.rows, null, 2));

        // Inspect user records
        const users = await pool.query("SELECT id, username, email, is_admin FROM users;");
        console.log("User Records:", JSON.stringify(users.rows, null, 2));
    } catch (err) {
        console.error("Error:", err.message);
        // If is_admin doesn't exist, try common role names
        try {
            const users = await pool.query("SELECT id, username, email FROM users;");
            console.log("User Records (basic):", JSON.stringify(users.rows, null, 2));
        } catch (inner) {
            console.error("Basic Query Error:", inner.message);
        }
    } finally {
        await pool.end();
    }
}

inspectUsers();
