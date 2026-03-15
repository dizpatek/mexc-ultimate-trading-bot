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
  cover_sl_deviation: 1.0,  // Image: TSL Sapma 1%
  pilot_tp_trailing: true,
  pilot_sl_trailing: true
};

export const DEFAULT_BOT_CONFIG = {
  f4_length: 11,
  f4_alpha: 95,
  fibo_alpha: 95,
  f4_slope_threshold: 0.01,
  fibo_length: 20,
  f4_power_loss_threshold: 90,
  trade_freshness_bars: 5,
  ai_threshold: 65,
  min_power_loss: 90,
  whale_multiplier: 3.0,
  auto_trade: false,
  defense_mode: false,
  pilot_trailing_buy: true,
  pilot_trailing_buy_dev: 0.3,
  pilot_tp_trailing: true,
  pilot_tp_deviation: 0.3,
  pilot_sl_trailing: true,
  pilot_sl_deviation: 1.0,
  pilot_timeframe: '4h',
  pilot_mtf_veto: true,
  pilot_mtf_threshold: 80,
  pilot_only_holdings: true,
  long_squeeze_threshold: 20,
  short_squeeze_threshold: 20,
  scalp_length: 11,
  scalp_volume_multiplier: 3.0,
  swing_length: 10,
  swing_volume_multiplier: 1.2,
  timeframe_settings: DEFAULT_TIMEFRAME_SETTINGS
};

export const V5_DEFAULTS = {
  SCALP: {
    f4Length: 11,
    whaleVolumeMultiplier: 3.0,
    f4SlopeThreshold: 0.01
  },
  SWING: {
    f4Length: 10,
    whaleVolumeMultiplier: 1.2,
    f4SlopeThreshold: 0.01
  },
  F4_STRATEGY: {
    powerLoss: 90,
    lookback: 30,
    squeeze: 20,
    minPowerLoss: 90,
    longSqueeze: 20,
    shortSqueeze: 20
  }
};
