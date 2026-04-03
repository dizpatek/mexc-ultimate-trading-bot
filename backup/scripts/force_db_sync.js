const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require'
});

async function run() {
  const settings = {
    pilot_tp_percent: 3.0,
    pilot_sl_percent: 1.2,
    pilot_tp_deviation: 0.12,
    pilot_sl_deviation: 0.20,
    cover_tp_percent: 2.5,
    cover_sl_percent: 1.0,
    cover_tp_deviation: 0.10,
    cover_sl_deviation: 0.18,
    pilot_trade_allocation: 8
  };
  
  const tfSettings = { "15m": settings, "1m": settings };
  
  const query = `
    UPDATE bot_configs SET
      pilot_timeframe = '15m',
      ai_threshold = 70,
      pilot_trailing_buy = true,
      pilot_mtf_veto = true,
      pilot_mtf_threshold = 20,
      pilot_mtf_long_threshold = 20,
      pilot_mtf_short_threshold = 20,
      pilot_only_holdings = true,
      fibo_length = 13,
      f4_lookback_bars = 20,
      f4_squeeze_threshold = 10,
      f4_power_loss_threshold = 87,
      min_power_loss = 87,
      f4_slope_threshold = 0.014,
      scalp_length = 8,
      scalp_volume_multiplier = 3.5,
      swing_length = 10,
      swing_volume_multiplier = 1.2,
      long_squeeze_threshold = 12,
      short_squeeze_threshold = 12,
      trade_freshness_bars = 4,
      whale_multiplier = 1.3,
      f4_multiplier = 3.2,
      timeframe_settings = $1::jsonb,
      updated_at = $2
    WHERE user_id = 1
  `;
  try {
    const res = await pool.query(query, [JSON.stringify(tfSettings), Date.now()]);
    console.log('DB tam senkronize edildi', res.rowCount);
  } catch(e) {
    console.error('Hata:', e.message);
  }
  await pool.end();
}

run();
