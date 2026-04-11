---
title: "MTF Consensus"
tags: [concept, mtf, veto, multi-timeframe]
related:
  - entities/MtfEngine
  - entities/MatrixV5Strategy
  - flows/01-signal-flow
lastUpdated: 2026-04-09
type: concept
---

# 🕐 MTF Consensus — Multi-Timeframe Oylama Sistemi

---

## Nedir?

Tek bir timeframe'in sinyali, birden fazla timeframe'in oylama sistemiyle doğrulanır veya veto edilir.

```
Örnek: 1h timeframe'de BUY sinyali geldi
MTF kontrol: 4h, 1d, 15m de aynı yönde mi?
→ Evet → Sinyal onaylandı
→ Hayır → VETOEDı
```

---

## [-100, +100] Skala

```
+100 → Tüm timeframe'ler kuvvetli BULLISH
  0  → Nötr / Karışık
-100 → Tüm timeframe'ler kuvvetli BEARISH

mtfLongThreshold  = +20 (BUY için minimum)
mtfShortThreshold = -20 (SELL için maksimum)
```

---

## Nearest TF Guard

```
Her sinyalde bir üst timeframe (nearest) özellikle kontrol edilir:

BUY + nearestScore < -20 → VETO (yakın TF bearish)
SELL + nearestScore > +20 → VETO (yakın TF bullish)

"Bir üst periyot sinyale karşıysa girme"
```

---

## applyMtfVeto() Karar Ağacı

```
1. isNearestOpposite? → Veto (en sert)
2. BUY + score < +20? → Veto
3. SELL + score > -20? → Veto
4. isEarly + BUY + score < -20? → Veto (erken sinyal ekstra korumalı)
5. isEarly + SELL + score > -10? → Veto
6. Geçti → Onaylandı
```

---

## verdictText Formatı

```
"+32 GÜÇLÜ BOĞA"
"-15 ZAYIF AYI"
"0 NÖTR"
```

---

## Bağlantılar

- **Modül:** [[entities/MtfEngine|MtfEngine]]
- **Kullanılan:** [[entities/MatrixV5Strategy|MatrixV5Strategy.applyMtfVeto()]]
- **Akış:** [[flows/01-signal-flow|Sinyal Akışı]]
