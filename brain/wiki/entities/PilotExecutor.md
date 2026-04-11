---
title: PilotExecutor
tags: [entity, pilot, execution, reentry, cdt]
sourceFile: src/lib/pilot-executor.ts
size: "50KB / 1068 satır"
lastUpdated: 2026-04-11
type: entity
---

# ✈️ PilotExecutor

**Dosya:** `src/lib/pilot-executor.ts`
**Bağımlı:** `/api/cron/strategies`
**İçe aktarır:** [[entities/SmartTrade|SmartTrade]] · [[entities/SmartTradeExecution|SmartTradeExecution]] · `src/lib/db`

---

## Public API

```typescript
class PilotExecutor {
  // Bellek sistemleri
  static getReEntrySymbols(userId): string[]
  static ensureReEntryMapLoaded(userId): Promise<void>
  
  // Allocation kararı
  static calculateAllocation(userId, symbol, holdingsMap, botConfig, signalType)
    → { hasHolding, targetQty, isNewBuy, isReEntry, reEntryUsdt, isCoverReEntry, coverReEntryQty }
  
  // Execution dalları
  static executeNewBuy(...)        // Yeni USDT ile alım
  static executeReEntryBuy(...)    // Önceki satış USDT ile
  static executeCoverReEntryBuy(...) // CDT: Cover qty ile LONG
  static executeCover(...)         // SELL → Short pozisyon
  static closeSmartTrade(...)      // Matrix Flip için
  
  // Kayıt
  static recordSignalResult(...)   // strategy_signals UPDATE
  
  // Ana handler
  static handleSignal(params): Promise<void>
}

// Module-level exports
export function registerCoverSale(userId, symbol, qty, coverId)
export function clearCoverSale(userId, symbol)
export function registerPilotReEntry(userId, symbol, usdtProceeds)
```

---

## In-Memory Bellek Haritaları

### pilotReEntryMap
```
Map<userId, Map<symbol, ReEntryRecord>>
{
  lastSaleUsdt: number,  // USDT gelirleri
  lastSaleAt: number,    // Satış zamanı
  symbol: string         // Orijinal sembol
}
DB'den yüklenir → restart-safe (60s throttle)
```

### coverSaleMap
```
Map<userId, Map<symbol, CoverSaleRecord>>
{
  qty: number,      // Satılan token miktarı
  symbol: string,
  coverId: number   // Cover order DB ID
}
In-memory → restart'ta sıfırlanır!
```

---

## normalizeSymbol()

```typescript
// "BTCUSDTUSDT" → "BTCUSDT"
// "BTC/USDT" → "BTCUSDT"
symbol.toUpperCase()
  .replace(/[^A-Z0-9]/g, "")
  .replace("USDTUSDT", "USDT")
```

---

## calculateAllocation() Mantığı

```
totalQty = free + locked (holding)

SELL için: targetQty = min(totalQty × allocPct, free)
BUY için:  targetQty = totalQty (tümünü yönet)

hasHolding = totalQty > 0.00001

İsReEntry    = !hasHolding && BUY && pilotReEntryMap'te var
isCoverReEntry = !hasHolding && !isReEntry && BUY && coverSaleMap'te var
isNewBuy     = !hasHolding && !isReEntry && !isCoverReEntry && BUY && pilot_only_holdings=false
```

---

## handleSignal() Guard'ları (Sıralı)

1. **Timeframe Guard** — scanTF ≠ pilotTF → yalnızca UI log, trade yok
2. **Dedup Guard** — Son 5dk'da aynı sembol execute edildi → skip
3. **Mode Guard (matrix)** — Sembol bazlı max 1 LONG + max 1 SHORT
4. **Mode Guard (hedge)** — Global max 1 LONG + max 1 SHORT
5. **Matrix Flip Guard** — Mevcut trade yaşı < 3dk → flip engellendi

---

## Bağlantılar

- **Akış:** [[flows/02-pilot-flow|Pilot Akışı]]
- **Kavramlar:** [[concepts/CDT-ReEntry|CDT Re-Entry]] · [[concepts/ReEntrySystem|Re-Entry Sistemi]] · [[concepts/PilotModes|Pilot Modları]] · [[concepts/Matrix-Flip|Matrix Flip]]
