# 📋 MexCBrain Wiki — Değişiklik Günlüğü

## [2026-04-22] fix | Research Core — Eksik Parametre Düzeltmeleri ve Senkronizasyon

- **İşlem:** Kritik düzeltmeler / senkronizasyon
- **Kapsam:** Tüm Research Core (AutoResearchPanel, Route API, Parameter Mutator, Bot Defaults, Worker)
- **Kaynak:** `src/app/api/autoresearch/route.ts`, `src/lib/parameterMutator.ts`, `src/lib/constants/bot-defaults.ts`, `_tools/system/bot-worker.mjs`
- **Notlar:** Root BotConfig coverage/control parametreleri, DEFAULT_PARAMS eşleştirmesi, worker tetikleme mekanizması tamamlandı

### Değişiklik Detayları

- `apply_all_tf`: `timeframe_settings[tf]` içine `cover_tp_percent`, `cover_sl_percent`, `cover_tp_trailing`, `cover_tp_deviation`, `cover_sl_trailing`, `cover_sl_deviation` eklendi.
- `apply_best`: root `BotConfig` güncellemesi için `cover_tp_percent`, `cover_sl_percent`, `cover_tp_trailing`, `cover_tp_deviation`, `cover_sl_trailing`, `cover_sl_deviation` eklenerek TP/SL yükseklik/yapılandırması tamamlandı.
- `parameterMutator.ts`: `DEFAULT_PARAMS.cover_sl_percent` 0.45 → 0.8 (PARAM_SPACE.min=0.8 ile uyumlu).
- `bot-defaults.ts` ↔ `parameterMutator.ts`: Varsayılan parametreler senkronize edildi; özellikle `cover_sl_percent` 0.8 olarak ortak değer kullanılıyor.
- `bot-worker.mjs`: Otopilot, trailing-stop, alarms, price-history, portfolio-snapshot, janitor gibi tüm cron'ları tetikleyen ortak arka plan mekanizması eklendi; `DEFAULT_TRADING_MODE` env varsayılanı "test" → "production" önerisi.
- `00-INDEX.md` ve `00-LOG.md`: Dokümantasyon güncellendi; log entry formatı korundu.

## [2026-04-22] build | Wiki yeniden oluşturuldu

- **İşlem:** Tam build
- **Güncellenen:** 25 sayfa
- **Değişmeyen:** 0 sayfa
- **Kapsam:** Tüm entity sayfaları

---
