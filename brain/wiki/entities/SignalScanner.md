---
title: SignalScanner
tags: [entity, scanner, parallel, dedup]
sourceFile: src/services/SignalScanner.ts
size: "14KB / 349 satır"
lastUpdated: 2026-04-22
type: entity
---

# 📡 SignalScanner

**Dosya:** `src/services/SignalScanner.ts`
**Çağrılır:** `/api/cron/strategies`
**İçe aktarır:** [[entities/MatrixV5Strategy|MatrixV5Strategy]] · `src/lib/db` · `src/lib/mexc-wrapper`

---

## Public API

```typescript
class SignalScanner {
  static resolveScanSymbols(userId, mode, botConfig?) → string[]
  static runScan(userId, symbols, targetTimeframe?, mode?) → ScanResult[]
  private static scanSymbol(userId, symbol, existingTypes, interval, tradingMode, botConfig?) → {...}
}
```

---

## ScanResult Interface

```typescript
interface ScanResult {
  symbol: string;
  signalType: string;     // BUY | SELL | VETOED_BUY | SCANNER_BUY | ...
  price: number;
  detail: string;
  aiScore: number;
  inserted: boolean;
  vetoReason?: string;
}
```

---

## resolveScanSymbols()

| Parametre | Test Modu | Production Modu |
|---|---|---|
| Holdings | Aktif orders + Simulator bakiyeleri | Gerçek MEXC cüzdanı |
| `pilot_only_holdings=true` | Holdings + Top 20 (max 80) | Holdings + Top 20 (max 80) |
| `pilot_only_holdings=false` | Holdings + Top 60 + Defaults (max 120) | Holdings + Top 60 + Defaults (max 120) |

**Default semboller:**
BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, AVAXUSDT, LINKUSDT, DOTUSDT

---

## runScan() — Paralel Tarama

```
1. getBotConfig(userId) ← bir kez çek
2. getRecentSignalsBulk() ← tüm sembollerin son 5dk sinyalleri
3. symbol × timeframe kombinasyonları → scanTasks[]
4. CONCURRENCY=8 ile Promise.allSettled() chunk'lar
5. createStrategySignalsBulk() ← toplu DB INSERT
6. Yüksek skor (>75) sinyaller için logSystemEvent()
```

---

## Signal Tipi Dönüşümü

```
BUY/SELL (veto'suz) → SCANNER_BUY / SCANNER_SELL
  (Scanner sadece tarar, execute etmez — Pilot execute eder)

BUY/SELL (MTF veto) → VETOED_BUY / VETOED_SELL
  (vetoReason field dolu)

Balina tespit (sinyal yok) → WHALE

Durum yok → INFO
```

---

## Bağlantılar

- **Akış:** [[flows/01-signal-flow|Sinyal Akışı]]
- **Çağırdığı:** [[entities/MatrixV5Strategy|MatrixV5Strategy]] · [[entities/MatrixV5Engine|MatrixV5Engine]]
