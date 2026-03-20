import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { getTradingModeSync } from "@/lib/trading-mode";

export interface TimeframeSettings {
  tradeMode?: string;
  pilot_trade_allocation?: number;
  pilot_mode?: 'matrix' | 'hedge';
  pilot_use_usdt?: boolean;
  pilot_tp_percent?: number;
  pilot_sl_percent?: number;
  pilot_tp_trailing?: boolean;
  pilot_tp_deviation?: number;
  pilot_sl_trailing?: boolean;
  pilot_sl_deviation?: number;
  cover_tp_percent?: number;
  cover_sl_percent?: number;
  cover_tp_trailing?: boolean;
  cover_tp_deviation?: number;
  cover_sl_trailing?: boolean;
  cover_sl_deviation?: number;
  [key: string]: any;
}

export interface BotConfig {
  auto_trade: boolean;
  pilot_timeframe: string;
  pilot_trailing_buy: boolean;
  pilot_only_holdings: boolean;
  pilot_mode?: 'matrix' | 'hedge';
  pilot_use_usdt?: boolean;
  defense_mode?: boolean;
  ai_threshold?: number;
  whale_multiplier?: number;
  f4_multiplier?: number;
  f4_length?: number;
  f4_lookback_bars?: number;
  f4_squeeze_threshold?: number;
  f4_power_loss_threshold?: number;
  min_power_loss?: number;
  trade_freshness_bars?: number;
  pilot_mtf_veto?: boolean;
  pilot_mtf_long_threshold?: number;
  pilot_mtf_short_threshold?: number;
  pilot_mtf_threshold?: number;
  pilot_trailing_buy_dev?: number;
  pilot_tp_trailing?: boolean;
  pilot_tp_deviation?: number;
  pilot_sl_trailing?: boolean;
  pilot_sl_deviation?: number;
  timeframe_settings?: TimeframeSettings;
  [key: string]: any;
}

export function useBotConfig() {
  const [config, setConfig] = useState<BotConfig | null>(() => {
    if (typeof window !== "undefined") {
      const mode = getTradingModeSync();
      const cached = localStorage.getItem(`bot_config_cache_${mode}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;
    const loadConf = async () => {
      try {
        const res = await api.get("/bot/config");
        if (mounted && res.data && !res.data.error) {
          setConfig(res.data);
          const mode = getTradingModeSync();
          localStorage.setItem(`bot_config_cache_${mode}`, JSON.stringify(res.data));
        }
      } catch (err) {
        /* silent */
      }
    };
    loadConf();
    
    // Sync state locally across components without api delay
    const onLocalUpdate = () => {
       const mode = getTradingModeSync();
       const cached = localStorage.getItem(`bot_config_cache_${mode}`);
       if (!cached) {
         setConfig(null);
       } else {
         try {
           setConfig(JSON.parse(cached));
         } catch (e) {
           setConfig(null);
         }
       }
    };
    window.addEventListener("botConfigUpdated", onLocalUpdate);
    window.addEventListener("storage", onLocalUpdate);

    // Refresh periodically in case of external changes
    const id = setInterval(loadConf, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
      window.removeEventListener("botConfigUpdated", onLocalUpdate);
      window.removeEventListener("storage", onLocalUpdate);
    };
  }, []);

  return { config };
}
