import { pool, sql } from "../../../src/lib/postgres";

async function testConnection() {
    // Overriding DATABASE_URL for admin test
    const adminUrl = "postgresql://_189019fee2eb8cdf:_def148f9291522b0ba075e16883abe@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29790/_68afee465836?sslmode=require";
    process.env.DATABASE_URL = adminUrl;

    console.log("Testing connection as ADMIN to:", process.env.DATABASE_URL?.split('@')[1]);
    try {
        const res = await sql`SELECT version(), now(), current_user;`;
        console.log("Connection successful:", res.rows[0]);
        
        console.log("Testing write access as ADMIN...");
        await sql`CREATE TABLE IF NOT EXISTS _test_write_admin (id serial primary key, t timestamp default now());`;
        await sql`INSERT INTO _test_write_admin DEFAULT VALUES;`;
        console.log("Write access confirmed for ADMIN.");
        
        await sql`DROP TABLE _test_write_admin;`;
        console.log("Cleanup successful.");
        process.exit(0);
    } catch (err: any) {
        console.error("Connection failed as ADMIN:", err.message);
        if (err.code) console.error("Error Code:", err.code);
        process.exit(1);
    }
}

testConnection();
