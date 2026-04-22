import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += '?sslmode=require';
}
(process.env as any).NODE_ENV = 'production';

async function testAnalysis() {
  const { sql } = await import('../../src/lib/postgres');
  
  const trades = await sql`
      SELECT id, symbol, side, type, price as entry_price, status, created_at, meta
      FROM orders
      WHERE trading_mode = 'test'
      ORDER BY created_at DESC LIMIT 50
  `;
  
  const history = await sql`
      SELECT order_id, symbol, side, entry_price, exit_price, pnl_usdt, sl_price, tp_price, close_reason, meta
      FROM trade_history
      WHERE trading_mode = 'test'
      ORDER BY closed_at DESC LIMIT 100
  `;
  
  console.log(`Active/Orders count: ${trades.rows.length}`);
  console.log(`Trade History count: ${history.rows.length}`);
  
  if (history.rows.length > 0) {
      console.log('Sample histories:', JSON.stringify(history.rows.slice(0, 3).map(r => ({
          symbol: r.symbol, side: r.side, pnl: r.pnl_usdt, reason: r.close_reason, meta: (r as any).meta.slice(0, 50) + '...'
      })), null, 2));
  }
}
testAnalysis().catch(e=>console.error(e)).finally(()=>process.exit(0));
