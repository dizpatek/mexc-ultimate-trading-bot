import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

async function run() {
  const { sql } = await import('../src/lib/postgres.ts');
  
  console.log('🚀 Uygulanıyor: Dashboard Performans İndeksleri...');
  
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_mode_status ON orders(user_id, trading_mode, status);`;
    console.log('✅ Index created: idx_orders_user_mode_status');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`;
    console.log('✅ Index created: idx_orders_created_at');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_trade_history_order_id ON trade_history(order_id);`;
    console.log('✅ Index created: idx_trade_history_order_id');
    
    console.log('\n✨ Tüm performans optimizasyonları başarıyla uygulandı.');
  } catch (error) {
    console.error('❌ İndeks oluşturma hatası:', error);
  }
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
