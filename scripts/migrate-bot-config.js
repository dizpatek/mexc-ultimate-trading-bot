// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sql } = require('@vercel/postgres');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function init() {
  try {
    console.log('Creating bot_configs table...');
    await sql`CREATE TABLE IF NOT EXISTS bot_configs (
      id SERIAL PRIMARY KEY,
      f4_length INTEGER DEFAULT 10,
      whale_multiplier FLOAT DEFAULT 1.8,
      ai_threshold INTEGER DEFAULT 65,
      auto_trade BOOLEAN DEFAULT false,
      updated_at BIGINT
    )`;

    console.log('Checking for existing config...');
    const result = await sql`SELECT * FROM bot_configs WHERE id = 1`;
    
    if (result.rows.length === 0) {
      console.log('Inserting default config...');
      await sql`INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, updated_at) 
                VALUES (1, 10, 1.8, 65, false, ${Date.now()})`;
    } else {
      console.log('Config already exists.');
    }
    
    console.log('Database migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

init();
