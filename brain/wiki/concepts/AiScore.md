---
title: "AI Score Hesaplama"
tags: [concept, ai-score, giga-master, confluence, scoring]
related:
  - entities/MatrixV5Engine
  - flows/01-signal-flow
lastUpdated: 2026-04-09
type: concept
---

# 🧠 AI Score Hesaplama — GIGA MASTER Formülü

MexCBrain'de her sinyal bir **AI Score (0-100)** ile birlikte gelir. Bu skor, sinyalin ne kadar güvenilir olduğunu gösterir.

---

## GIGA MASTER AI Score Bileşenleri

```
Toplam: 100 puan

Component              Max  Açıklama
─────────────────────────────────────────────────────
whaleConfirmed          15  Balina volume tespit edildi mi?
regimeAlignment         10  Piyasa rejimi sinyale uygun mu?
volumePower             15  OBV + VPA hacim gücü
trendAlignment          10  EMA Ribbon, Ichimoku trend onayı
mtfConsensus            15  MTF consensus skoru (normalize)
momentumAccel           15  F4 Power + StochRSI + ADX momentum
volatilityRegime        10  Fiyat breakout bölgesinde mi?
zScore                  10  İstatistiksel Z-score analizi
─────────────────────────────────────────────────────
TOPLAM                 100
```

---

## Minimum Eşik

```
minAiScore = botConfig.ai_threshold || 65

Sinyal üretilmesi için:
  aiScore >= 65 (varsayılan)

Özel durum: whaleDetected + aiScore >= 80 → yüksek öncelik
```

---

## Confluence Score (Ayrı)

AI Score'dan bağımsız 6 kategorili ağırlıklı toplam:

```
Tech (RSI, MACD, SuperTrend, WaveTrend): %30
Momentum (StochRSI, ADX, slope):         %15
Volume (Whale, OBV, VPA, ADM):           %20
Trend (EMA Ribbon, Ichimoku, HA):        %15
Market (Funding, Regime, SMC):           %15
Timing (VIX Fix, Fibo, Liquidity):       %5

minConfluenceScore = 60
```

---

## F4 Mandate — AI Score Tek Başına Yetmez

```
F4 AKTİF = f4EarlyBuy OR f4ConfirmedBuy 
           OR f4EarlySell OR f4ConfirmedSell

F4 Aktif Değilse → return null (hiç sinyal yok)
ne kadar yüksek aiScore olursa olsun
```

---

## Bayesian Öğrenme

```
Engine her sinyal sonucunu bayesianMetrics'e kaydeder:
  totalSignals, winSignals → currentWinRate
  emaWinRate (exponential, λ=0.15)
  recentStreak (art arda kazanç/kayıp)
  regimeShiftCount (piyasa rejim değişimi)

Bu metrikler zScore ve trapPenalty hesabında kullanılır.
```

---

## Bağlantılar

- **Modül:** [[entities/MatrixV5Engine|MatrixV5Engine]]
- **Akış:** [[flows/01-signal-flow|Sinyal Akışı]]
- **İlgili:** [[concepts/Confluence|Confluence Engine]] · [[concepts/MTF-Consensus|MTF Consensus]]
