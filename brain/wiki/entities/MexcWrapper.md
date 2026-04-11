---
title: MexcWrapper
tags: [entity, mexc, api, exchange]
sourceFile: src/lib/mexc-wrapper.ts
size: "11KB / 338 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🌐 MexcWrapper

**Dosya:** `src/lib/mexc-wrapper.ts`
**Kullanılan:** [[entities/SmartTradeExecution|SmartTradeExecution]] · [[entities/PilotExecutor|PilotExecutor]] · [[entities/SignalScanner|SignalScanner]]

MEXC Exchange API ile iletişim katmanı. Tüm order ve fiyat işlemleri buradan geçer.

---

## Key Functions

```typescript
getPrice(symbol): Promise<number>
getAccountInfo(userId, mode): Promise<AccountInfo>
marketBuyByQuote(userId, symbol, quoteAmount, mode)  // USDT ile alım
marketSellByQty(userId, symbol, qty, mode)            // Miktar ile satış
getTopAssets(limit): Promise<Asset[]>                 // Top N kripto
batchFetchPrices(symbols): Promise<Record<string, number>>
```

---

## TradingMode

```typescript
type TradingMode = "test" | "production"
// test: Simülatör modu (MEXC API çağrısı yok)
// production: Gerçek order gönderilir
```

---

## Bağlantılar

- **Akış:** [[flows/03-execution-flow|Execution Akışı]]
