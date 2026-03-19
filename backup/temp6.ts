import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getDbUrl() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    if (line.startsWith('POSTGRES_URL=')) {
        let url = line.split('=')[1].trim();
        if (url.startsWith('"')) url = url.slice(1, -1);
        if (!url.includes('sslmode=')) url += '?sslmode=require';
        return url;
    }
  }
}

const pool = new Pool({ 
  connectionString: getDbUrl() || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const timeLimit = Date.now() - 1000 * 60 * 15; // last 15 mins

    // Logs
    const logRes = await pool.query(
      `SELECT timestamp, level, message, details 
       FROM system_logs 
       WHERE timestamp > $1 
       ORDER BY timestamp DESC LIMIT 20`,
       [timeLimit]
    );

    // Signals
    const sigRes = await pool.query(
      `SELECT id, symbol, signal_type, timeframe, timestamp, executed, veto_reason 
       FROM strategy_signals 
       WHERE timestamp > $1 
       ORDER BY timestamp DESC LIMIT 20`,
       [timeLimit]
    );
    
    // DB orders
    const orderRes = await pool.query(
      `SELECT id, symbol, status, side, created_at, trading_mode, meta::jsonb->>'smartTrade' as smart_trade, meta::jsonb->>'source' as source 
       FROM orders 
       WHERE created_at > $1 
       ORDER BY created_at DESC LIMIT 10`,
       [timeLimit]
    );

    console.log("=== LAST 20 SYSTEM LOGS ===");
    console.table(logRes.rows.map(r => ({
      time: new Date(Number(r.timestamp)).toLocaleTimeString(),
      level: r.level,
      msg: r.message?.substring(0, 50),
      desc: r.details?.substring(0, 50)
    })));

    console.log("\n=== LAST 20 SIGNALS ===");
    console.table(sigRes.rows.map(r => ({
      time: new Date(Number(r.timestamp)).toLocaleTimeString(),
      symbol: r.symbol,
      sgnl: r.signal_type,
      tf: r.timeframe,
      exec: r.executed,
      veto: r.veto_reason?.substring(0, 50)
    })));
    
    console.log("\n=== LAST 10 DB ORDERS ===");
    console.table(orderRes.rows.map(r => ({
      time: new Date(Number(r.created_at)).toLocaleTimeString(),
      symbol: r.symbol,
      st: r.status,
      sd: r.side,
      src: r.source
    })));

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
