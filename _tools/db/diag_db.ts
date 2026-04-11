import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    console.log("POSTGRES_URL length:", process.env.POSTGRES_URL?.length || 0);
    const pool = new Pool({ 
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        const users = await pool.query("SELECT id, username FROM users");
        console.log("Users:", JSON.stringify(users.rows));
        
        const adminId = users.rows.find((u: any) => u.username === 'admin')?.id;
        if (adminId) {
            const portfolio = await pool.query("SELECT asset, free FROM portfolio WHERE user_id = $1", [adminId]);
            console.log("Portfolio for admin (" + adminId + "):", portfolio.rows.length, "items");
            console.log("Portfolio samples:", JSON.stringify(portfolio.rows.slice(0, 3)));
            
            const history = await pool.query("SELECT COUNT(*) FROM trade_history WHERE user_id = $1", [adminId]);
            console.log("Trade History count for admin:", history.rows[0].count);
            
            const historyTest = await pool.query("SELECT COUNT(*) FROM trade_history WHERE user_id = $1 AND trading_mode = 'test'", [adminId]);
            console.log("Trade History (test) count for admin:", historyTest.rows[0].count);
            
            const settings = await pool.query("SELECT * FROM settings WHERE key = 'TRADING_MODE' AND user_id = $1", [adminId]);
            console.log("TRADING_MODE setting:", JSON.stringify(settings.rows[0] || 'not set'));
        }
    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        await pool.end();
    }
}

run();
