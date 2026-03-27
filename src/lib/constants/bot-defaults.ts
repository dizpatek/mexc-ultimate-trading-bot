export type TimeframeSettings = {
  pilot_tp_percent: number;
  pilot_sl_percent: number;
  cover_tp_percent: number;
  cover_sl_percent: number;
  cover_tp_trailing: boolean;
  cover_tp_deviation: number;
  cover_sl_trailing: boolean;
  cover_sl_deviation: number;
  pilot_tp_trailing: boolean;
  pilot_tp_deviation: number;
  pilot_sl_trailing: boolean;
  pilot_sl_deviation: number;
  pilot_mode: "matrix" | "hedge";
  pilot_use_usdt: boolean;
};

export const DEFAULT_TIMEFRAME_SETTINGS: TimeframeSettings = {
  pilot_tp_percent: 1.2,
  pilot_sl_percent: 0.65,
  cover_tp_percent: 1.1,
  cover_sl_percent: 0.45,
  cover_tp_trailing: true,
  cover_tp_deviation: 0.11,
  cover_sl_trailing: true,
  cover_sl_deviation: 0.20,
  pilot_tp_trailing: true,
  pilot_tp_deviation: 0.12,
  pilot_sl_trailing: true,
  pilot_sl_deviation: 0.22,
  pilot_mode: "matrix",
  pilot_use_usdt: false
};

export const DEFAULT_BOT_CONFIG = {
  f4_length: 11,
  f4_alpha: 95,
  fibo_alpha: 95,
  f4_slope_threshold: 0.01,
  f4_multiplier: 1.0,
  scalp_f4_multiplier: 3.7,
  swing_f4_multiplier: 1.2,
  fibo_length: 20,
  f4_power_loss_threshold: 90,
  trade_freshness_bars: 5,
  ai_threshold: 65,
  min_power_loss: 90,
  whale_multiplier: 1.2,
  f4_lookback_bars: 30,
  f4_squeeze_threshold: 20,
  auto_trade: false,
  defense_mode: false,
  pilot_trailing_buy: true,
  pilot_trailing_buy_dev: 0.12, // TTP Sapma (Dev) için
  pilot_tp_trailing: true,
  pilot_tp_deviation: 0.12,
  pilot_sl_trailing: true,
  pilot_sl_deviation: 0.22,
  pilot_timeframe: '1h',
  pilot_mtf_veto: true,
  pilot_mtf_threshold: 65,
  pilot_mtf_long_threshold: 70,
  pilot_mtf_short_threshold: 30,
  pilot_only_holdings: true,
  pilot_mode: "matrix" as const,
  pilot_use_usdt: false,
  long_squeeze_threshold: 20,
  short_squeeze_threshold: 20,
  scalp_length: 11,
  scalp_volume_multiplier: 3.0,
  swing_length: 10,
  swing_volume_multiplier: 1.2,
  timeframe_settings: {
    pilot_trade_allocation: 10,
    pilot_tp_percent: 1.2,
    pilot_sl_percent: 0.65,
    cover_tp_percent: 1.1,
    cover_sl_percent: 0.45,
    cover_tp_trailing: true,
    cover_tp_deviation: 0.11,
    cover_sl_trailing: true,
    cover_sl_deviation: 0.20,
    pilot_tp_trailing: true,
    pilot_tp_deviation: 0.12,
    pilot_sl_trailing: true,
    pilot_sl_deviation: 0.22,
    pilot_mode: "matrix" as const,
    pilot_use_usdt: false,
  }
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

export interface TimeframePreset {
  // Sistem Kontrol & Genel
  pilot_mtf_veto: boolean;
  pilot_mtf_threshold: number;
  pilot_mtf_long_threshold: number;
  pilot_mtf_short_threshold: number;
  pilot_trailing_buy: boolean; // GECİKMELİ ALIM
  pilot_only_holdings: boolean;
  pilot_trade_allocation: number; // İŞLEM BÜYÜKLÜĞÜ

  // Trade (Long)
  pilot_tp_percent: number;
  pilot_sl_percent: number;
  pilot_tp_deviation: number;
  pilot_sl_deviation: number;

  // Cover (Geri Alım)
  cover_tp_percent: number;
  cover_sl_percent: number;
  cover_tp_deviation: number;
  cover_sl_deviation: number;

  // AI & F4
  ai_threshold: number;
  whale_multiplier: number;
  fibo_length: number;

  f4_active: boolean; // F4 Durumu
  scalp_length: number;
  scalp_volume_multiplier: number;
  swing_length: number;
  swing_volume_multiplier: number;
  trade_freshness_bars: number;
  f4_multiplier: number;
  
  f4_lookback_bars: number;
  f4_squeeze_threshold: number;
  f4_power_loss_threshold: number;
  f4_slope_threshold: number;
  long_squeeze_threshold: number;
  short_squeeze_threshold: number;
  min_power_loss: number;
  pilot_mode: "matrix" | "hedge";
  pilot_use_usdt: boolean;
}

export const TIMEFRAME_PRESETS: Record<string, TimeframePreset> = {
  "1m": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 70, pilot_mtf_long_threshold: 70, pilot_mtf_short_threshold: 30, pilot_trailing_buy: false, pilot_only_holdings: true, pilot_trade_allocation: 3,
    pilot_tp_percent: 1.0, pilot_sl_percent: 0.6, pilot_tp_deviation: 0.12, pilot_sl_deviation: 0.20,
    cover_tp_percent: 0.9, cover_sl_percent: 0.50, cover_tp_deviation: 0.10, cover_sl_deviation: 0.18,
    ai_threshold: 72, whale_multiplier: 1.5, fibo_length: 8, f4_active: true,
    scalp_length: 5, scalp_volume_multiplier: 4.0, swing_length: 8, swing_volume_multiplier: 1.0,
    f4_lookback_bars: 15, f4_squeeze_threshold: 10, f4_power_loss_threshold: 85, f4_slope_threshold: 0.018, long_squeeze_threshold: 12, short_squeeze_threshold: 12, min_power_loss: 85,
    trade_freshness_bars: 3, f4_multiplier: 4.0,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "15m": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 65, pilot_mtf_long_threshold: 65, pilot_mtf_short_threshold: 35, pilot_trailing_buy: false, pilot_only_holdings: true, pilot_trade_allocation: 5,
    pilot_tp_percent: 1.8, pilot_sl_percent: 1.0, pilot_tp_deviation: 0.18, pilot_sl_deviation: 0.25,
    cover_tp_percent: 1.6, cover_sl_percent: 0.9, cover_tp_deviation: 0.15, cover_sl_deviation: 0.22,
    ai_threshold: 68, whale_multiplier: 1.3, fibo_length: 13, f4_active: true,
    scalp_length: 8, scalp_volume_multiplier: 3.5, swing_length: 9, swing_volume_multiplier: 1.1,
    f4_lookback_bars: 20, f4_squeeze_threshold: 14, f4_power_loss_threshold: 87, f4_slope_threshold: 0.014, long_squeeze_threshold: 16, short_squeeze_threshold: 16, min_power_loss: 87,
    trade_freshness_bars: 5, f4_multiplier: 3.2,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "1h": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 60, pilot_mtf_long_threshold: 60, pilot_mtf_short_threshold: 40, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 10,
    pilot_tp_percent: 3.5, pilot_sl_percent: 1.8, pilot_tp_deviation: 0.25, pilot_sl_deviation: 0.35,
    cover_tp_percent: 3.0, cover_sl_percent: 1.6, cover_tp_deviation: 0.22, cover_sl_deviation: 0.30,
    ai_threshold: 65, whale_multiplier: 1.2, fibo_length: 20, f4_active: true,
    scalp_length: 11, scalp_volume_multiplier: 3.0, swing_length: 10, swing_volume_multiplier: 1.2,
    f4_lookback_bars: 30, f4_squeeze_threshold: 20, f4_power_loss_threshold: 90, f4_slope_threshold: 0.010, long_squeeze_threshold: 20, short_squeeze_threshold: 20, min_power_loss: 90,
    trade_freshness_bars: 5, f4_multiplier: 2.5,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "4h": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 60, pilot_mtf_long_threshold: 60, pilot_mtf_short_threshold: 40, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 12,
    pilot_tp_percent: 7.5, pilot_sl_percent: 3.8, pilot_tp_deviation: 0.45, pilot_sl_deviation: 0.60,
    cover_tp_percent: 6.8, cover_sl_percent: 3.5, cover_tp_deviation: 0.40, cover_sl_deviation: 0.55,
    ai_threshold: 65, whale_multiplier: 1.2, fibo_length: 26, f4_active: true,
    scalp_length: 13, scalp_volume_multiplier: 2.5, swing_length: 12, swing_volume_multiplier: 1.3,
    f4_lookback_bars: 40, f4_squeeze_threshold: 25, f4_power_loss_threshold: 88, f4_slope_threshold: 0.008, long_squeeze_threshold: 24, short_squeeze_threshold: 24, min_power_loss: 88,
    trade_freshness_bars: 8, f4_multiplier: 2.0,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "1d": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 60, pilot_mtf_long_threshold: 70, pilot_mtf_short_threshold: 30, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 15,
    pilot_tp_percent: 18.0, pilot_sl_percent: 9.0, pilot_tp_deviation: 0.85, pilot_sl_deviation: 1.20,
    cover_tp_percent: 16.0, cover_sl_percent: 8.0, cover_tp_deviation: 0.75, cover_sl_deviation: 1.00,
    ai_threshold: 65, whale_multiplier: 1.4, fibo_length: 34, f4_active: true,
    scalp_length: 16, scalp_volume_multiplier: 2.0, swing_length: 15, swing_volume_multiplier: 1.4,
    f4_lookback_bars: 55, f4_squeeze_threshold: 30, f4_power_loss_threshold: 85, f4_slope_threshold: 0.006, long_squeeze_threshold: 28, short_squeeze_threshold: 28, min_power_loss: 85,
    trade_freshness_bars: 10, f4_multiplier: 1.5,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "1w": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 60, pilot_mtf_long_threshold: 75, pilot_mtf_short_threshold: 25, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 20,
    pilot_tp_percent: 35.0, pilot_sl_percent: 15.0, pilot_tp_deviation: 1.50, pilot_sl_deviation: 2.50,
    cover_tp_percent: 32.0, cover_sl_percent: 14.0, cover_tp_deviation: 1.30, cover_sl_deviation: 2.20,
    ai_threshold: 70, whale_multiplier: 1.5, fibo_length: 50, f4_active: true,
    scalp_length: 20, scalp_volume_multiplier: 1.8, swing_length: 18, swing_volume_multiplier: 1.5,
    f4_lookback_bars: 80, f4_squeeze_threshold: 35, f4_power_loss_threshold: 80, f4_slope_threshold: 0.004, long_squeeze_threshold: 32, short_squeeze_threshold: 32, min_power_loss: 80,
    trade_freshness_bars: 15, f4_multiplier: 1.2,
    pilot_mode: "matrix", pilot_use_usdt: false
  },
  "1M": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 60, pilot_mtf_long_threshold: 80, pilot_mtf_short_threshold: 20, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 25,
    pilot_tp_percent: 60.0, pilot_sl_percent: 25.0, pilot_tp_deviation: 2.50, pilot_sl_deviation: 4.00,
    cover_tp_percent: 55.0, cover_sl_percent: 22.0, cover_tp_deviation: 2.20, cover_sl_deviation: 3.50,
    ai_threshold: 75, whale_multiplier: 1.8, fibo_length: 89, f4_active: true,
    scalp_length: 28, scalp_volume_multiplier: 1.5, swing_length: 25, swing_volume_multiplier: 1.6,
    f4_lookback_bars: 120, f4_squeeze_threshold: 50, f4_power_loss_threshold: 75, f4_slope_threshold: 0.002, long_squeeze_threshold: 36, short_squeeze_threshold: 36, min_power_loss: 75,
    trade_freshness_bars: 20, f4_multiplier: 1.0,
    pilot_mode: "matrix", pilot_use_usdt: false
  }
};

export function getTimeframeSettings(tf: string): TimeframePreset {
    return TIMEFRAME_PRESETS[tf] || TIMEFRAME_PRESETS['1h'];
}
