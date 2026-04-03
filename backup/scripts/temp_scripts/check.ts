import { sql } from './src/lib/postgres';

async function getUsers() {
    try {
        const { rows } = await sql`SELECT * FROM users LIMIT 10`;
        console.log("USERS FETCHED:");
        for(const u of rows) {
             console.log(`Email: ${u.email} | Pass: ${u.password_hash || u.password} | Role: ${u.role}`);
        }
    } catch (e) {
        console.error("DB Error:", e);
    }
}

getUsers();
