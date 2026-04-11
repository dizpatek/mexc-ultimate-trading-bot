---
title: SmartTrade
tags: [entity, smart-trade, entry, handler]
sourceFile: src/lib/smart-trade.ts
size: "12KB / 341 satır"
lastUpdated: 2026-04-11
type: entity
---

# ⚡ SmartTrade

**Dosya:** `src/lib/smart-trade.ts`
**Kullanılan:** [[entities/PilotExecutor|PilotExecutor]]
**Kullandığı:** [[entities/MexcWrapper|MexcWrapper]] · `src/lib/db`

Yeni bir SmartTrade açmak için ana handler. Entry execution ve DB kaydını yönetir.

---

## Key Function

```typescript
handleSmartTrade(payload: SmartTradePayload, forcedMode?: TradingMode)
  → { success, orderId, dbId, mode, symbol, avgPrice }
```

---

## Entry Senaryoları

| Senaryo | Trigger |
|---|---|
| Normal Market Buy | `mode=TRADE, useExisting=false` |
| Mevcut Varlık | `useExisting=true` |
| Trailing Buy | `trailingBuy=true` → PENDING |
| Market Sell | `mode=COVER` |

---

## Bağlantılar

- **Akış:** [[flows/03-execution-flow|Execution Akışı]]
- **Çağıran:** [[entities/PilotExecutor|PilotExecutor]]
