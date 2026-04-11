---
title: "02 — Pilot Akışı"
tags: [flow, pilot, execution, matrix, hedge, reentry, cdt]
sourceFiles:
  - src/lib/pilot-executor.ts
  - src/app/api/cron/strategies/route.ts
lastUpdated: 2026-04-09
type: flow
---

# ✈️ Pilot Akışı — Sinyal Kararından SmartTrade'e

Bu sayfa, bir sinyalin `PilotExecutor` tarafından nasıl işlendiğini belgeler.
**← Öncesi:** [[01-signal-flow|Sinyal Akışı]] | **Sonrası →** [[03-execution-flow|Execution Akışı]]

---

## Ana Karar Diyagramı

```mermaid
flowchart TD
    START["📡 PilotExecutor.handleSignal()\nsignal: BUY | SELL"] --> TF_CHECK

    TF_CHECK{{"Timeframe Eşleşmesi?\nscanTF == pilotTF"}}
    TF_CHECK -->|"❌ Farklı"| LOG_ONLY["UI'a logla\n(trade açma)"]
    TF_CHECK -->|"✅ Eşleşiyor"| DEDUP

    DEDUP{{"Son 5dk içinde\nbu sembol execute\nedildi mi?"}}
    DEDUP -->|"✅ Evet"| SKIP["Sinyal atla (dedup)"]
    DEDUP -->|"❌ Hayır"| ALLOC

    ALLOC["calculateAllocation()\nholdings kontrolü"] --> SIGNAL_TYPE

    SIGNAL_TYPE{{"signal.signal"}}
    SIGNAL_TYPE -->|"BUY"| BUY_BRANCH
    SIGNAL_TYPE -->|"SELL"| SELL_BRANCH

    subgraph BUY_BRANCH["🟢 BUY Dalı"]
        B1{{"Aktif COVER\nvar mı? (Matrix Flip)"}} 
        B1 -->|"✅ Evet + pilot_auto"| FLIP["Matrix Flip:\nCOVER kapat → TRADE aç"]
        B1 -->|"❌ Hayır"| B2
        
        B2{{"hasHolding?"}}
        B2 -->|"✅ Evet"| EXISTING["Mevcut varlık\nyönetimi (TP/SL güncelle)"]
        B2 -->|"❌ Hayır"| B3

        B3{{"isReEntry?"}}
        B3 -->|"✅ Evet"| REENTRY["executeReEntryBuy()\nÖnceki satış USDT ile"]
        B3 -->|"❌ Hayır"| B4

        B4{{"isCoverReEntry (CDT)?"}}
        B4 -->|"✅ Evet"| CDT["executeCoverReEntryBuy()\nCover miktarı ile LONG"]
        B4 -->|"❌ Hayır"| B5

        B5{{"isNewBuy?\n(pilot_only_holdings=false)"}}
        B5 -->|"✅ Evet"| NEWBUY["executeNewBuy()\nUSDT bakiyesinden"]
        B5 -->|"❌ Hayır"| SKIP2["ATLA\n(holdings only mod)"]
    end

    subgraph SELL_BRANCH["🔴 SELL Dalı"]
        S1{{"Aktif TRADE var mı?"}}
        S1 -->|"✅ Matrix Flip"| FLIP2["TRADE kapat → COVER aç"]
        S1 -->|"❌ Hayır"| S2
        S2{{"hasHolding?"}}
        S2 -->|"✅ Evet"| COVER["executeCover()\nSat + buyback bekle"]
        S2 -->|"❌ Hayır"| SKIP3["ATLA\n(satacak varlık yok)"]
    end

    NEWBUY --> RECORD["recordSignalResult()\nstrategy_signals UPDATE"]
    REENTRY --> RECORD
    CDT --> RECORD
    COVER --> RECORD
    FLIP --> RECORD

    style START fill:#1a1a2e,color:#00d4ff
    style BUY_BRANCH fill:#0a2a0a,color:#e0e0e0
    style SELL_BRANCH fill:#2a0a0a,color:#e0e0e0
    style NEWBUY fill:#1a3d1a,color:#6bff6b,stroke:#6bff6b
    style COVER fill:#3d1a1a,color:#ff6b6b,stroke:#ff6b6b
    style REENTRY fill:#1a2a3d,color:#6bb5ff,stroke:#6bb5ff
    style CDT fill:#2a1a3d,color:#b56bff,stroke:#b56bff
    style FLIP fill:#3d3d00,color:#ffff6b,stroke:#ffff6b
```

---

## Pilot Modları

**Kaynak:** [[entities/PilotExecutor|PilotExecutor]] → `botConfig.pilot_mode`

| Mod | Kural |
|---|---|
| `matrix` | Sembol bazlı — her sembol için max 1 LONG, max 1 SHORT |
| `hedge` | Global — tüm sembollerde max 1 LONG, max 1 SHORT |

---

## 5 Execution Yolu (BUY için)

### Yol 1: executeNewBuy()
```
Koşul: hasHolding=false, isReEntry=false, isCoverReEntry=false,
        pilot_only_holdings=false
Kaynak: USDT bakiyesi × pilot_trade_allocation%
Max: $100,000 güvenlik sınırı
```
**Kaynak:** [[entities/PilotExecutor#executeNewBuy|PilotExecutor.executeNewBuy()]]

### Yol 2: executeReEntryBuy()
```
Koşul: hasHolding=false, önceki pilot_auto TRADE satışı var
Kaynak: pilotReEntryMap → önceki satıştan gelen USDT
Not: DB'den yüklenir (restart sonrası da çalışır)
```
**Kavram:** [[concepts/ReEntrySystem|Re-Entry Sistemi]]

### Yol 3: executeCoverReEntryBuy() — CDT
```
Koşul: hasHolding=false, önceki COVER satışı var (coverSaleMap)
Kaynak: coverSaleMap → satılan token miktarı
Süreç: COVER sat → BUY sinyalinde aynı miktarı geri al
```
**Kavram:** [[concepts/CDT-ReEntry|CDT Re-Entry Sistemi]]

### Yol 4: Mevcut Varlık Yönetimi
```
Koşul: hasHolding=true, BUY sinyali
Action: Mevcut pozisyon için SmartTrade güncelle (TP/SL revize)
targetQty = totalQty (tüm bakiye yönetimi)
```

### Yol 5: Matrix Flip (BUY + Aktif COVER)
```
Koşul: Aktif COVER işlemi var (pilot_auto kaynaklı)
       Trade yaşı >= 3 dakika (MIN_FLIP_AGE_MS)
Action:
  1. COVER'ı closeSmartTrade() ile kapat
  2. holdingsMap güncelle
  3. coverSaleMap temizle
  4. Normal BUY akışına devam
```
**Kavram:** [[concepts/Matrix-Flip|Matrix Flip]]

---

## validatePilotTargets() — TP/SL Kontrolü

Her execution yolundan önce çalışır:

```
TP/SL Validasyon Kuralları:
✅ Long: TP > giriş fiyatı (kullanıcı eşiğinden yukarı)
✅ Long: SL < giriş fiyatı (kullanıcı eşiğinden aşağı)
✅ Short: TP < giriş fiyatı (kullanıcı eşiğinden aşağı)
✅ Short: SL > giriş fiyatı (kullanıcı eşiğinin üstünde)
✅ Risk/Reward: TP mesafesi >= SL mesafesi × 1.5
✅ Minimum SL: giriş fiyatından en az %0.3 uzakta
```

---

## handleSignal() → recordSignalResult()

Her sinyal (execute edilse de edilmese de) DB'ye yazılır:

```typescript
createStrategySignal({
  executed: boolean,        // İşlem açıldı mı?
  veto_reason: string,      // Neden açılmadı?
  execution_result: {...},  // Sonuç detayları
  trading_mode: mode,       // test | production
})
```

---

## Re-Entry Bellek Sistemi

```
pilotReEntryMap: Map<userId, Map<symbol, ReEntryRecord>>
├── DB'den yüklenir (restart-safe, 60s throttle)
├── consumeReEntry() → DB'de reEntryConsumed = true işaretler
└── registerPilotReEntry() → executeExit()'ten çağrılır

coverSaleMap: Map<userId, Map<symbol, CoverSaleRecord>>
├── In-memory (restart'ta sıfırlanır)
├── registerCoverSale() → executeCover()'dan çağrılır
└── clearCoverSale() → executeExit(COVER)'dan çağrılır
```

---

## Bağlantılar

- **Önceki aşama:** [[01-signal-flow|Sinyal Akışı]]
- **Sonraki aşama:** [[03-execution-flow|Execution Akışı]]
- **Modül:** [[entities/PilotExecutor|PilotExecutor]]
- **Kavramlar:** [[concepts/CDT-ReEntry|CDT Re-Entry]] · [[concepts/Matrix-Flip|Matrix Flip]] · [[concepts/PilotModes|Pilot Modları]] · [[concepts/ReEntrySystem|Re-Entry Sistemi]]
