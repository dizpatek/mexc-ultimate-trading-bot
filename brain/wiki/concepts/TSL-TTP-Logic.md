---
title: "TSL / TTP Mantığı"
tags: [concept, tsl, ttp, trailing, stop-loss, take-profit]
related:
  - flows/04-monitor-flow
  - entities/SmartTradeMonitor
  - entities/TradingLogic
lastUpdated: 2026-04-22
type: concept
---

# 📈 TSL / TTP Mantığı — Trailing Stop-Loss ve Take-Profit

---

## TSL — Trailing Stop Loss

### Temel Fikir

TSL, fiyat lehimize hareket ettikçe Stop Loss'u peşinden sürükler. Fiyat geri döndüğünde ise SL hareketsiz kalır (monotonicity).

```
LONG için:
  Fiyat YUKARI → TSL YUKARI taşınır (ama aşağı düşmez)

COVER (Short) için:
  Fiyat AŞAĞI → TSL AŞAĞI taşınır (ama yukarı çıkmaz)
```

### İki Aşamalı Mesafe

```
Phase 1 (TP henüz hit olmadı):
  distRatio = |entryPrice - initialSL| / entryPrice
  → Tam SL mesafesi kullanılır (güvenli)

Phase 2 (TP hit oldu, tpTriggered=true):
  distRatio = deviation / 100
  → Kullanıcının ayarladığı küçük mesafe
  → Kâr koruma modu — "sıkı takip"
```

> [!WARNING]
> **Kritik Düzeltme (FIX-B):** Eskiden TSL yalnızca TP hit sonrası aktifleşiyordu. Bu %86 zarar oranının başlıca nedenliydi. Artık TSL anında (warmup sonrası) aktif.

### Warmup Buffer (60 Saniye)

```
İşlem açıldıktan sonraki 60s içinde:
  currentDrop < slThreshold × 2.0 → SL TEYKİLEDE

"Anlık dalgalanmayı SL olarak sayma — piyasaya nefes al"

True kırılım (2.0× eşiği aşıyorsa) → Normal SL işleniyor

UPDATED (2026-04-22): 30s/1.2x → 60s/2.0x
Neden: Dar SL mesafeleri (0.3-0.6%) anlık volatilitede hemen tetikleniyordu.
```

### Minimum Mesafe Guard

```
Minimum: giriş fiyatından %0.1 uzaklık
(Çok sıkı SL = anlık fiyat dalgalanmasında tetiklenir)
```

### HARD BOUNDARY GUARD (2026-04-22)

```
TSL asla entry fiyatını geçemez:
  LONG:  TSL ≥ entryPrice (düşemez)
  SHORT: TSL ≤ entryPrice (yükseltilemez)

Neden: TSL'nin entry'nin ötesine "açılması" zarar riski yaratır.
Özellikle COVER'da fiyat düştükçe TSL entry altına inebiliyordu.
```

### COVER TIGHTENING (2026-04-22)

```
COVER'da fiyat yükseldikçe (zarar yönünde):
  risePct = (highest - entry) / entry
  tightenedSL = slPrice * (1 + risePct * 0.2)

Neden: Normal TSL sadece "kar yönünde" (fiyat düşerken) takip eder.
COVER'da fiyat yükseldiğinde SL sabit kalıyordu.
Bu mekanizma zararı sınırlamak için SL'yi entry'ye doğru sıkıştırır.
```

### mono-tonicity Kuralı

```typescript
// LONG:
finalSL = Math.max(trailSL, prevSL); // Asla aşağı düşmez

// COVER:
finalSL = Math.min(trailSL, prevSL); // Asla yukarı çıkmaz
```

---

## TTP — Trailing Take Profit

### Aktivasyon

```
1. currentPrice >= tpPrice (LONG) → tpTriggered = true
2. meta.ttpActivationPrice = currentPrice (başlangıç koy)
3. TTP döngüsü başlar
```

### Takip Mantığı

```
devPercent = payload.takeProfit.deviation

trailExit = calculateTrailingExitTarget(highest, devPercent)

// LONG için:
finalTp = Math.max(trailExit, prevTp)  // Asla aşağı düşmez

// Exit koşulu:
currentPrice <= finalTp → EXIT
```

### Neden Bu Şekilde?

```
TTP olmadan: Fiyat TP'ye geldi, satıldı.
  → Fiyat TP'yi geçip 2×'e gidebilirdi.

TTP ile: TP'ye geldi, henüz satılmadı.
  → Fiyat deviance% geri çekilince satıldı.
  → Mümkün olan en yüksek noktada satış.
```

---

## calculateTrailingExitTarget()

**Kaynak:** `src/lib/trading-logic.ts`

```typescript
calculateTrailingExitTarget(
  mode: "TRADE" | "COVER",
  highest: number,
  lowest: number,
  entryPrice: number,
  distPercent: number
): number

// TRADE (Long):
  return highest × (1 - distPercent / 100)

// COVER (Short):
  return lowest × (1 + distPercent / 100)
```

---

## SL Timeout

```
sl.timeout = true, sl.timeoutSeconds = N

Algoritma:
1. SL hit → slTimeoutStart = now (kaydet)
2. Çık! (henüz exit yok)
3. Her döngüde: now - slTimeoutStart >= N×1000?
   → Evet → EXIT
   → Hayır → bekle
4. Fiyat SL'nin üstüne çıktı? → slTimeoutStart = null (sıfırla)
```

---

## Breakeven

```
sl.breakeven = true AND filledTargets.length > 0:
  slPrice = entryPrice
  meta.slMovedToBreakeven = true

→ TP1 hit olunca SL giriş fiyatına taşınır
→ "Sıfır zarar garantisi"
```

---

## Bağlantılar

- **Akış:** [[flows/04-monitor-flow|Monitor Akışı]]
- **Modül:** [[entities/SmartTradeMonitor|SmartTradeMonitor]] · [[entities/TradingLogic|TradingLogic]]
