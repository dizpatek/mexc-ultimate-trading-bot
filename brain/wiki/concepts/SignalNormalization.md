---
title: Sinyal Normalizasyonu
tags: [concept, data, normalization, signals]
lastUpdated: 2026-04-11
type: concept
---

# 📐 Sinyal Normalizasyonu

Farklı kaynaklardan (Scanner, Manual, Telegram vb.) gelen ham verilerin sistem genelinde ortak bir dile (`LogEntry` veya `Signal` objesi) dönüştürülmesi sürecidir.

## Süreç Adımları
1. **Validation**: Eksik alanların (price, symbol) saptanması.
2. **Standardization**: Timeframe ("15m", "15Min") ve Sembol ("btc-usdt", "BTCUSDT") yazımlarının eşitlenmesi.
3. **Detail Extraction**: Ham payload içinden veto nedenleri ve indikatörlerin ayıklanması.

## Bağlantılar
- [[entities/CombatLogsHook|CombatLogsHook]]
- [[entities/SignalScanner|SignalScanner]]
