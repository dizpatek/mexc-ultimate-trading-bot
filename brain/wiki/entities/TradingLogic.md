---
title: TradingLogic
tags: [entity, trading, trailing, calculation]
sourceFile: src/lib/trading-logic.ts
size: "25KB / 767 satır"
lastUpdated: 2026-04-11
type: entity
---

# 📐 TradingLogic

**Dosya:** `src/lib/trading-logic.ts`
**Kullanılan:** [[entities/SmartTradeMonitor|SmartTradeMonitor]]

TSL ve TTP için matematiksel hesaplama fonksiyonları.

---

## Key Functions

```typescript
calculateTrailingExitTarget(
  mode: "TRADE" | "COVER",
  highest: number,
  lowest: number,
  entryPrice: number,
  distPercent: number
): number

calculateTrailingBuyTarget(payload, currentPrice): number
```

---

## Bağlantılar

- **Akış:** [[flows/04-monitor-flow|Monitor Akışı]]
- **Kavram:** [[concepts/TSL-TTP-Logic|TSL/TTP Mantığı]]
