---
title: SmartTradeExecution
tags: [entity, execution, entry, exit, mexc]
sourceFile: src/lib/smart-trade-execution.ts
size: "12KB / 322 satır"
lastUpdated: 2026-04-22
type: entity
---

# ⚡ SmartTradeExecution

**Dosya:** `src/lib/smart-trade-execution.ts`
**Bağımlı:** [[entities/SmartTradeMonitor|SmartTradeMonitor]] · [[entities/PilotExecutor|PilotExecutor]]
**İçe aktarır:** [[entities/MexcWrapper|MexcWrapper]] · `src/lib/engine/execution`

---

## Public API

```typescript
export async function executeEntry(trade, currentPrice, reason, metaParam)
export async function executeExit(trade, currentPrice, reason, meta, currentQty)
export async function executePartialTP(trade, currentPrice, currentQty, exec, meta, metaUpdates, tpTriggered)
export async function saveTradeUpdate(id, qty, meta)
```

---

## executeEntry()

```
1. determineExecutionStrategy() → order tipi kararı
2. BUY: marketBuyByQuote() / SELL: marketSellByQty()
3. Trailing Buy SL/TP Düzeltmesi:
   - avgPrice ≠ originalBuyPrice?
   - SL ve TP % mesafeyi koruyarak yeniden hesap
4. UPDATE orders SET status='FILLED', price=avgPrice
   meta = {..., entryReason, entryResult, filledAt}
```

---

## executeExit()

```
1. BUY ise: marketSellByQty(qty)
2. SELL ise: marketBuyByQuote(qty × price)
3. realExitPrice = cummulativeQuoteQty / executedQty
4. PnL hesapla (Long/Short ayrı formül)
5. registerPilotReEntry() ← pilot_auto TRADE satışları
6. UPDATE orders SET status='CLOSED'
7. insertTradeHistory()
8. calculateDailyPerformance()
9. COVER ise: clearCoverSale()
```

---

## executePartialTP()

```
Split TP hedeflerinde kısmi satış:
1. Hedef qty kadar sat
2. insertTradeHistory(type: "PARTIAL_TP")
3. calculateDailyPerformance()
4. filledTargets[].push(targetIndex)
5. newQty = currentQty - executed
→ Trade devam eder
```

---

## Re-Entry Hook Koşulları

```
tradeMode === 'TRADE'     AND
source === 'pilot_auto'   AND
side === 'BUY'            AND
usdtProceeds >= $5

→ registerPilotReEntry(userId, symbol, usdtProceeds)
```

---

## Bağlantılar

- **Akış:** [[flows/03-execution-flow|Execution Akışı]] · [[flows/05-exit-flow|Exit Akışı]]
- **Çağıran:** [[entities/SmartTradeMonitor|SmartTradeMonitor]] · [[entities/PilotExecutor|PilotExecutor]]
