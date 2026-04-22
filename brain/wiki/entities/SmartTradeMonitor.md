---
title: SmartTradeMonitor
tags: [entity, monitor, loop, tsl, ttp]
sourceFile: src/lib/smart-trade-monitor.ts
size: "35KB / 1092 satır"
lastUpdated: 2026-04-22
type: entity
---

# 🔄 SmartTradeMonitor

**Dosya:** `src/lib/smart-trade-monitor.ts`
**Tetiklenir:** `/api/cron/trailing-stop` (her 1s)
**İçe aktarır:** [[entities/SmartTradeExecution|SmartTradeExecution]] · [[entities/MatrixV5Engine|MatrixV5Engine]] · [[entities/TradingLogic|TradingLogic]]

---

## Public API

```typescript
export async function monitorSmartTrades(tradingMode: "test" | "production")
```

---

## Sabitler

```typescript
MONITOR_INTERVAL = 1000    // ms (1 saniye)
AI_ANALYSIS_INTERVAL = 60000  // ms (60 saniye)
CONCURRENCY_LIMIT = 20     // paralel trade işleme
```

---

## İç Fonksiyon Mimarisi

```
monitorSmartTrades()
├── ensureInitialized() ← DB repair (bir kez)
├── sql SELECT aktif orders
├── batchFetchPrices() ← tek API çağrısı
└── processTradeMonitoring() × N [paralel, limit:20]
    ├── runAiAnalysis() ← MatrixV5Engine [60s cache]
    ├── handlePendingTrade() ← PENDING trades
    │   └── calculateTrailingBuyTarget()
    └── evaluateActiveTrade() ← FILLED trades
        ├── evaluateStopLoss()
        │   ├── TSL Path (trailing=true)
        │   │   ├── calculateTrailingExitTarget()
        │   │   ├── Monotonicity guard (max/min)
        │   │   └── 30s Warmup buffer
        │   └── Fixed SL Path
        └── evaluateTakeProfit()
            ├── Trailing TP (TTP)
            ├── Split TP (Kademeli)
            └── Fixed TP
```

---

## MonitoredTrade Interface

```typescript
interface MonitoredTrade {
  id: number;
  user_id: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;          // Entry price
  meta: TradeMeta;
  status: string;
  trading_mode: "test" | "production";
}
```

---

## TradeMeta Kritik Alanları

| Alan | Açıklama |
|---|---|
| `payload` | Tam SmartTradePayload (TP/SL config) |
| `highestPrice` | TSL için peak price tracker |
| `lowestPrice` | TSL (Cover) için bottom tracker |
| `tpTriggered` | TTP aktif mi? |
| `activeStopLoss` | Güncel TSL seviyesi |
| `activeTakeProfit` | Güncel TTP seviyesi |
| `filledTargets` | Doldurulan split TP indexleri |
| `slMovedToBreakeven` | SL başa başa taşındı mı? |
| `slTimeoutStart` | SL timeout başlangıcı |
| `filledAt` | Entry zamanı (warmup buffer için) |
| `lastAiRunAt` | Son AI analizi zamanı |
| `tslActivated` | TSL ilk kez devreye girdi mi? |

---

## KlineCache

```typescript
// Döngü içi cache — redundant API çağrılarını önler
interface KlineCacheItem {
  klines: { close, high, low, volume }[];
  timestamp: number;
}
type KlineCache = Record<string, KlineCacheItem>;
// Key: "BTCUSDT-1h"
```

---

## Bağlantılar

- **Akış:** [[flows/04-monitor-flow|Monitor Akışı]]
- **Çağırdıkları:** [[entities/SmartTradeExecution|SmartTradeExecution.executeExit()]] · [[entities/MatrixV5Engine|MatrixV5Engine]]
- **Kavramlar:** [[concepts/TSL-TTP-Logic|TSL/TTP Mantığı]]
