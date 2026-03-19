export interface TimeframePreset {
  // Sistem Kontrol & Genel
  pilot_mtf_veto: boolean;
  pilot_mtf_threshold: number;
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
  
  f4_lookback_bars: number;
  f4_squeeze_threshold: number;
  f4_power_loss_threshold: number;
  min_power_loss: number;
}

export const TIMEFRAME_PRESETS: Record<string, TimeframePreset> = {
  "1m": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 70, pilot_trailing_buy: false, pilot_only_holdings: true, pilot_trade_allocation: 3,
    pilot_tp_percent: 1.2, pilot_sl_percent: 0.6, pilot_tp_deviation: 0.15, pilot_sl_deviation: 0.20,
    cover_tp_percent: 1.1, cover_sl_percent: 0.50, cover_tp_deviation: 0.13, cover_sl_deviation: 0.18,
    ai_threshold: 72, whale_multiplier: 1.0, fibo_length: 8, f4_active: true,
    scalp_length: 5, scalp_volume_multiplier: 4.0, swing_length: 8, swing_volume_multiplier: 1.0,
    f4_lookback_bars: 15, f4_squeeze_threshold: 10, f4_power_loss_threshold: 85, min_power_loss: 85
  },
  "15m": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 65, pilot_trailing_buy: false, pilot_only_holdings: true, pilot_trade_allocation: 5,
    pilot_tp_percent: 1.0, pilot_sl_percent: 0.55, pilot_tp_deviation: 0.12, pilot_sl_deviation: 0.18,
    cover_tp_percent: 0.9, cover_sl_percent: 0.40, cover_tp_deviation: 0.10, cover_sl_deviation: 0.15,
    ai_threshold: 65, whale_multiplier: 1.1, fibo_length: 13, f4_active: true,
    scalp_length: 8, scalp_volume_multiplier: 3.5, swing_length: 9, swing_volume_multiplier: 1.1,
    f4_lookback_bars: 20, f4_squeeze_threshold: 14, f4_power_loss_threshold: 87, min_power_loss: 87
  },
  "1h": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 65, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 10,
    pilot_tp_percent: 1.2, pilot_sl_percent: 0.65, pilot_tp_deviation: 0.12, pilot_sl_deviation: 0.22,
    cover_tp_percent: 1.1, cover_sl_percent: 0.45, cover_tp_deviation: 0.11, cover_sl_deviation: 0.20,
    ai_threshold: 65, whale_multiplier: 1.2, fibo_length: 20, f4_active: true,
    scalp_length: 11, scalp_volume_multiplier: 3.0, swing_length: 10, swing_volume_multiplier: 1.2,
    f4_lookback_bars: 30, f4_squeeze_threshold: 20, f4_power_loss_threshold: 90, min_power_loss: 90
  },
  "4h": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 68, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 12,
    pilot_tp_percent: 2.0, pilot_sl_percent: 1.0, pilot_tp_deviation: 0.18, pilot_sl_deviation: 0.28,
    cover_tp_percent: 1.8, cover_sl_percent: 0.65, cover_tp_deviation: 0.16, cover_sl_deviation: 0.25,
    ai_threshold: 68, whale_multiplier: 1.3, fibo_length: 26, f4_active: true,
    scalp_length: 13, scalp_volume_multiplier: 2.5, swing_length: 12, swing_volume_multiplier: 1.3,
    f4_lookback_bars: 40, f4_squeeze_threshold: 25, f4_power_loss_threshold: 88, min_power_loss: 88
  },
  "1d": {
    pilot_mtf_veto: true, pilot_mtf_threshold: 70, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 15,
    pilot_tp_percent: 3.0, pilot_sl_percent: 1.5, pilot_tp_deviation: 0.28, pilot_sl_deviation: 0.45,
    cover_tp_percent: 2.7, cover_sl_percent: 1.0, cover_tp_deviation: 0.25, cover_sl_deviation: 0.40,
    ai_threshold: 70, whale_multiplier: 1.4, fibo_length: 34, f4_active: true,
    scalp_length: 16, scalp_volume_multiplier: 2.0, swing_length: 15, swing_volume_multiplier: 1.4,
    f4_lookback_bars: 55, f4_squeeze_threshold: 30, f4_power_loss_threshold: 85, min_power_loss: 85
  },
  "1w": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 75, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 20,
    pilot_tp_percent: 6.0, pilot_sl_percent: 3.0, pilot_tp_deviation: 0.55, pilot_sl_deviation: 0.90,
    cover_tp_percent: 5.5, cover_sl_percent: 2.0, cover_tp_deviation: 0.50, cover_sl_deviation: 0.80,
    ai_threshold: 75, whale_multiplier: 1.5, fibo_length: 50, f4_active: true,
    scalp_length: 20, scalp_volume_multiplier: 1.8, swing_length: 18, swing_volume_multiplier: 1.5,
    f4_lookback_bars: 80, f4_squeeze_threshold: 35, f4_power_loss_threshold: 80, min_power_loss: 80
  },
  "1M": {
    pilot_mtf_veto: false, pilot_mtf_threshold: 80, pilot_trailing_buy: true, pilot_only_holdings: true, pilot_trade_allocation: 25,
    pilot_tp_percent: 12.0, pilot_sl_percent: 6.0, pilot_tp_deviation: 1.0, pilot_sl_deviation: 1.6,
    cover_tp_percent: 11.0, cover_sl_percent: 4.0, cover_tp_deviation: 0.9, cover_sl_deviation: 1.4,
    ai_threshold: 80, whale_multiplier: 1.8, fibo_length: 89, f4_active: true,
    scalp_length: 28, scalp_volume_multiplier: 1.5, swing_length: 25, swing_volume_multiplier: 1.6,
    f4_lookback_bars: 120, f4_squeeze_threshold: 50, f4_power_loss_threshold: 75, min_power_loss: 75
  }
};

export function getTimeframeSettings(tf: string): TimeframePreset {
    return TIMEFRAME_PRESETS[tf] || TIMEFRAME_PRESETS['1h'];
}
