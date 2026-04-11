---
title: Log Türleri (LogTypes)
tags: [concept, logs, combat-log]
lastUpdated: 2026-04-11
type: concept
---

# 📋 Log Türleri (LogTypes)

Sistem genelinde üretilen ve [[entities/CombatLog|CombatLog]] üzerinde gösterilen mesaj kategorileridir.

## Ana Türler
- **EXECUTION**: Gerçekleşmiş borsa emirleri (Buy/Sell/SL/TP).
- **AI_DECISION**: Matrix motoru tarafından verilen kararlar ve sinyaller.
- **SYSTEM**: Hata mesajları, bakiye uyarıları ve sistem durumları.
- **WHALE_ALERT**: Balina emir tespitleri.
- **STRUCTURE**: Formasyon (Trend, Range vb.) tespitleri.

## Bağlantılar
- [[entities/CombatLogsHook|CombatLogsHook]]
- [[entities/CombatLog|CombatLog UI]]
