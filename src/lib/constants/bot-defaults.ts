/**
 * Centralized Bot Configuration Defaults
 * This serves as the single source of truth for all modules including DB, Simulator, and UI.
 */

export const DEFAULT_TIMEFRAME_SETTINGS = {
  pilot_tp_percent: 2.0, // Image: Sabit TP 2%
  pilot_sl_percent: 1.0, // Image: Sabit SL 1%
  cover_tp_percent: 1.0, // Image: Geri Alım (TP) 1%
  cover_sl_percent: 1.0, // Image: Aşım (SL) 1%
  cover_tp_trailing: true, // Image: TTP Açık
  cover_tp_deviation: 0.3, // Image: TTP Sapma 0.3%
  cover_sl_trailing: true, // Image: TSL Açık
  cover_sl_deviation: 1.0  // Image: TSL Sapma 1%
};

export const DEFAULT_BOT_CONFIG = {
  f4_length: 10,
  whale_multiplier: 1.8,
  ai_threshold: 65,
  auto_trade: false,
  defense_mode: false,
  pilot_trailing_buy: true,
  pilot_trailing_buy_dev: 0.3,
  pilot_tp_trailing: true,
  pilot_tp_deviation: 0.3, // Image: TTP Sapma 0.3%
  pilot_sl_trailing: true,
  pilot_sl_deviation: 1.1, // Image: TSL Sapma 1.1%
  pilot_timeframe: '4h',
  fibo_length: 20,
  pilot_mtf_veto: true,
  pilot_mtf_threshold: 60,
  pilot_only_holdings: false,
  f4_power_loss_threshold: 90, // F4 Güç Kaybı Eşiği
  timeframe_settings: DEFAULT_TIMEFRAME_SETTINGS
};
