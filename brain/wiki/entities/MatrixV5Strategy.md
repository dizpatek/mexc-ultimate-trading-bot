---
title: MatrixV5Strategy
tags: [entity, strategy, matrix, wrapper, mtf-veto]
sourceFile: src/lib/strategies.ts
size: "19KB / 537 satır"
lastUpdated: 2026-04-22
type: entity
---

# 🎯 MatrixV5Strategy

**Dosya:** `src/lib/strategies.ts`
**Kullanılan:** [[entities/SignalScanner|SignalScanner]]
**Kullandığı:** [[entities/MatrixV5Engine|MatrixV5Engine]] · [[entities/MtfEngine|MtfEngine]]

`MatrixV5Engine`'i saran strateji wrapper'ı. MEXC klines verisi çeker, engine'e verir ve MTF veto uygular.

---

## analyze() Akışı

```
1. getKlines(symbol, timeframe, 500) → OHLCV verisi
2. fetchFundingRate(symbol) → Fonlama oranı
3. MatrixV5Engine.analyze(...) → MatrixV5Result
4. F4 Mandate kontrolü: f4EarlyBuy/Sell OR f4ConfirmedBuy/Sell
   → Yoksa null döner (sinyal yok)
5. getMtfConsensus() → MTF skoru
6. applyMtfVeto() → Sinyal onayı veya iptali
7. StrategySignal döner
```

---

## applyMtfVeto()

```
BUY + mtfScore < +20 → null (Veto)
SELL + mtfScore > -20 → null (Veto)
Nearest TF ters ise → null (En sert veto)
```

---

## Bağlantılar

- **Akış:** [[flows/01-signal-flow|Sinyal Akışı]]
- **Motor:** [[entities/MatrixV5Engine|MatrixV5Engine]]
- **Kavram:** [[concepts/MTF-Consensus|MTF Consensus]] · [[concepts/AiScore|AI Score]]
