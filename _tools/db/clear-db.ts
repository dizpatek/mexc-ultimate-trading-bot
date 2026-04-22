import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += '?sslmode=require';
}
async function fix() {
  const { sql } = await import('../../src/lib/postgres');
  const users = await sql`SELECT id FROM users`;
  for(const u of users.rows) {
     const cfg = await sql`SELECT timeframe_settings FROM bot_configs WHERE user_id = ${u.id}`;
     if(cfg.rows.length){
        const ts = cfg.rows[0].timeframe_settings || {};
        delete (ts as any).ar_symbols;
        await sql`UPDATE bot_configs SET timeframe_settings = ${ts} WHERE user_id = ${u.id}`;
     }
  }
}
fix().then(()=>console.log('Fixed DB')).catch(console.error).finally(()=>process.exit(0));
