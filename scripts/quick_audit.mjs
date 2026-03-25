import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const H2 = Date.now() - 2 * 60 * 60 * 1000;
const H12 = Date.now() - 12 * 60 * 60 * 1000;

// DB Config
const cfg = await pool.query(`SELECT user_id, pilot_mtf_long_threshold, pilot_mtf_short_threshold, pilot_mtf_veto, pilot_only_holdings, auto_trade, pilot_timeframe FROM bot_configs WHERE user_id=1`);
const c = cfg.rows[0];
console.log('CONFIG|user_id=1|long=' + c.pilot_mtf_long_threshold + '|short=' + c.pilot_mtf_short_threshold + '|veto=' + c.pilot_mtf_veto + '|only_holdings=' + c.pilot_only_holdings + '|auto_trade=' + c.auto_trade + '|tf=' + c.pilot_timeframe);

// Kolonlar
const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='strategy_signals' ORDER BY ordinal_position`);
console.log('COLS|' + cols.rows.map(r=>r.column_name).join('|'));

// Son 2 saat ozet
const s2 = await pool.query(`SELECT executed, signal_type, COUNT(*) as cnt FROM strategy_signals WHERE timestamp > $1 AND user_id=1 GROUP BY executed, signal_type ORDER BY executed DESC`, [H2]);
s2.rows.forEach(r => console.log('2H|' + (r.executed?'OPENED':'BLOCKED') + '|' + r.signal_type + '|' + r.cnt));

// Son 12 saat ozet
const s12 = await pool.query(`SELECT executed, signal_type, COUNT(*) as cnt FROM strategy_signals WHERE timestamp > $1 AND user_id=1 GROUP BY executed, signal_type ORDER BY executed DESC`, [H12]);
s12.rows.forEach(r => console.log('12H|' + (r.executed?'OPENED':'BLOCKED') + '|' + r.signal_type + '|' + r.cnt));

// Veto nedenleri ASCII-safe ozet
const vetos = await pool.query(`
  SELECT veto_reason, COUNT(*) as cnt FROM strategy_signals
  WHERE timestamp > $1 AND executed=false AND user_id=1
  GROUP BY veto_reason ORDER BY cnt DESC LIMIT 10
`, [H12]);
vetos.rows.forEach(r => console.log('VETO|' + r.cnt + '|' + String(r.veto_reason||'').replace(/[^\x20-\x7E%]/g, '?').substring(0,120)));

// Acilan sinyaller son 12h (kolonlara gore)
const opened = await pool.query(`
  SELECT symbol, signal_type, timestamp, veto_reason
  FROM strategy_signals WHERE timestamp > $1 AND executed=true AND user_id=1
  ORDER BY timestamp DESC LIMIT 10
`, [H12]);
opened.rows.forEach(r => {
  console.log('OPEN|' + r.symbol + '|' + r.signal_type + '|' + new Date(parseInt(r.timestamp)).toISOString().substring(11,16) + '|veto=' + String(r.veto_reason||'').substring(0,50));
});

await pool.end();
