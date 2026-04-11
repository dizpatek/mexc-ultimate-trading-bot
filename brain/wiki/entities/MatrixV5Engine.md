---
title: MatrixV5Engine
tags: [entity, engine, ai, confluence, indicators]
sourceFile: src/lib/matrix-v5-engine.ts
size: "100KB / 2413 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🧠 MatrixV5Engine

**Dosya:** `src/lib/matrix-v5-engine.ts` (2413 satır)
**Bağımlı:** [[entities/MatrixV5Strategy|MatrixV5Strategy]] · [[entities/SmartTradeMonitor|SmartTradeMonitor]]
**İçe aktarır:** `src/lib/engine/signal-arbitration.ts`

> MexCBrain'in kalbi. Pine Script'ten TypeScript'e port edilmiş AI analiz motoru.

---

## Imports

```typescript
import { evaluateSAE, SAEInput } from "./engine/signal-arbitration";
```

---

## Key Types

```typescript
class MatrixV5Engine {
  private config: MatrixV5Config;
  private bayesianMetrics = { totalSignals, winSignals, emaWinRate, ... };
  
  analyze(closes, highs, lows, volumes, timeframe, riskMode, fundingRate, configOverrides?, opens?)
    → MatrixV5Result
}
```

---

## MatrixV5Result — Çıktı Yapısı

| Alan | Tip | Açıklama |
|---|---|---|
| `signal` | `BUY\|SELL\|null` | Ana sinyal |
| `aiScore` | `number` | GIGA MASTER AI Skoru (0-100) |
| `f4Power` | `number` | F4 momentum [-100, +100] |
| `f4EarlyBuy/Sell` | `boolean` | Ön sinyal |
| `f4ConfirmedBuy/Sell` | `boolean` | Onaylı sinyal |
| `confluenceScore` | `number` | 6-kategori toplam |
| `regimePrediction` | `RegimePrediction` | Piyasa rejimi |
| `systemDecision` | `GO_LONG\|GO_SHORT\|WAIT` | Sistem kararı |
| `smc` | `SMCResult` | Smart Money Concepts |
| `targets` | `{t1, t2, sl}` | TP1, TP2, SL fiyatları |

---

## Gösterge Kategorileri

### Teknik (Tech) — %30
RSI · MACD · SuperTrend · WaveTrend

### Momentum — %15
StochRSI · ADX · F4 Slope · Acceleration

### Volume (Hacim) — %20  
Whale Engine · OBV · VPA · ADM

### Trend — %15
EMA Ribbon (8/21/55/200) · Ichimoku · Heikin-Ashi

### Market — %15
Funding Rate · Market Regime · SMC · Liquidity

### Timing — %5
VIX Fix (vixBottom) · Fibonacci · Liquidity Hunt

---

## TF Adaptasyon

```
getTfAdaptFactor(interval):
  1m  → 0.5  (daha kısa periyotlar)
  5m  → 0.7
  15m → 0.85
  1h  → 1.0  (baseline)
  4h  → 1.3
  1d+ → 1.6  (daha uzun periyotlar)
```

---

## Kullanım Yerleri

- [[entities/MatrixV5Strategy|MatrixV5Strategy.analyze()]] ← Scanner için
- [[entities/SmartTradeMonitor|SmartTradeMonitor.runAiAnalysis()]] ← Monitor için (60s cache)
