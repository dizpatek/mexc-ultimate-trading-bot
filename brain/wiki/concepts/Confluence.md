---
title: "Confluence Engine"
tags: [concept, confluence, scoring, indicators]
related:
  - entities/MatrixV5Engine
  - concepts/AiScore
lastUpdated: 2026-04-09
type: concept
---

# 🎯 Confluence Engine — 6 Kategorili Sinyal Gücü

**Confluence Score**, AI Score'dan bağımsız olarak 6 kategoriyi ağırlıklı toplamla değerlendirir. 

---

## 6 Kategori ve Ağırlıkları

```
Tech (RSI, MACD, SuperTrend, WaveTrend)    → %30
Momentum (StochRSI, ADX, slope)            → %15
Volume (Whale, OBV, VPA, ADM)              → %20
Trend (EMA Ribbon, Ichimoku, Heikin-Ashi)  → %15
Market (Funding, Regime, SMC)              → %15
Timing (VIX Fix, Fibo, Liquidity)          → %5
```

---

## Minimum Eşik

```
minConfluenceScore = 60 (varsayılan)

Eğer confluenceScore < 60 → Sinyal gücü yetersiz
  (F4 aktif olsa bile sinyal zayıf kabul edilir)
```

---

## Hesaplama

Her kategori kendi içinde `[0-100]` arasında puanlanır.
Ağırlıklı toplam alınır:

```
confluenceScore = (tech × 0.30)
               + (momentum × 0.15)
               + (volume × 0.20)
               + (trend × 0.15)
               + (market × 0.15)
               + (timing × 0.05)
```

---

## AI Score ile Farkı

| | Confluence Score | AI Score |
|---|---|---|
| **Yapı** | Kategorik ağırlıklı ortalama | Komponent bazlı (+bonus) |
| **Ölçek** | 0-100 | 0-100 |
| **Whale etkisi** | Volume kategorisinde (%20) | Direkt +15 puan |
| **Kullanım** | Sinyal güç kontrolü | Trade kararı güveni |

---

## Bağlantılar

- **Modül:** [[entities/MatrixV5Engine|MatrixV5Engine]]
- **İlgili:** [[concepts/AiScore|AI Score Hesaplama]]
