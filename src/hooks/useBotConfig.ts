import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { getTradingModeSync } from "@/lib/trading-mode";

export interface TimeframeSettings {
  tradeMode?: string;
  pilot_trade_allocation?: number;
  [key: string]: unknown;
}

export interface BotConfig {
  auto_trade: boolean;
  pilot_timeframe: string;
  pilot_trailing_buy: boolean;
  pilot_only_holdings: boolean;
  timeframe_settings?: TimeframeSettings;
  [key: string]: unknown;
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
