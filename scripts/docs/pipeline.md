# 🦅 Matrix V5: A'dan Z'ye Nihai Tek Harita — Mutlak Pipeline (v8.0)

> Bu doküman projenin tüm TypeScript ekosistemini kapsar. Her modülün kime bağlandığı, ne iş yaptığı ve import zinciri aşağıda detaylıdır.

---

## 🗺️ Bölüm 1: Global Veri Mimarisi — Katmanlar Arası Akış

```mermaid
graph TD
    subgraph Frontend ["ÖN YÜZ (src/components + src/hooks + src/services)"]
        UI1["ActiveSmartTrades.tsx (Aktif İşlemler)"]
        UI2["MatrixPortfolio.tsx (Portföy)"]
        UI3["CombatLog.tsx (Sistem Konsolu)"]
        UI4["SmartTrade.tsx (El İle İşlem)"]
        UI5["MatrixHorizon.tsx (Bot Ayarları)"]
        UI6["IntelligenceHub.tsx (Haber/Balina)"]
        H1["useTradingSignals.ts"]
        H2["usePortfolio.ts"]
        H3["useBotConfig.ts"]
        H4["useCombatLogs.ts"]
        H5["useSmartTradeLogic.ts"]
        SVC["src/services/api.ts (Axios İstemcisi)"]
        H1 --> UI1
        H2 --> UI2
        H4 --> UI3
        H3 --> UI5
        H1 & H2 & H3 & H4 & H5 --> SVC
    end

    subgraph Backend ["ARKA YÜZ (app/api + src/lib)"]
        API1["/api/indicators/f4 (Sinyaller)"]
        API2["/api/bot/config (Ayarlar)"]
        API3["/api/market/scan (Tarama)"]
        API4["/api/cron/strategies (Zamanlanmış)"]
        LIB1["strategy-engine.ts"]
        LIB2["matrix-v5-engine.ts"]
        LIB3["pilot-executor.ts"]
        LIB4["smart-trade-monitor.ts"]
        LIB5["smart-trade-execution.ts"]
        SVC --> API1 & API2 & API3 & API4
        API1 & API4 --> LIB1 --> LIB2 --> LIB3
        LIB3 --> LIB5
        LIB5 --> LIB4
    end

    subgraph ExternalWorld ["DIŞ DÜNYA"]
        DB[("PostgreSQL (db.ts)")]
        MEXC_WRAP["mexc-wrapper.ts (Dispatcher)"]
        MEXC_REAL["mexc.ts (Gerçek API)"]
        SIM["trading-simulator.ts (Sanal)"]
        LIB2 & LIB3 & LIB4 --> MEXC_WRAP
        MEXC_WRAP -->|PRODUCTION| MEXC_REAL
        MEXC_WRAP -->|TEST| SIM
        LIB1 & LIB5 --> DB
    end

    classDef ui fill:#44337a,stroke:#b794f4,color:#fff;
    classDef core fill:#2d3748,stroke:#4fd1c5,color:#fff;
    classDef exchange fill:#4a1212,stroke:#f56565,color:#fff;
    class UI1,UI2,UI3,UI4,UI5,UI6,H1,H2,H3,H4,H5 ui;
    class LIB1,LIB2,LIB3,LIB4,LIB5 core;
    class MEXC_WRAP,MEXC_REAL,SIM exchange;
```

---

## ⚙️ Bölüm 2: Otopilot İşlem Hattı — 7 Katman Detayı

```mermaid
graph TD
    BOOT["L1: strategy-engine.ts — isScannerRunning? Kontrol"] --> MEM["L1: RAM Cache — BotConfig + pilotReEntryMap yükle"]
    MEM --> SCAN["L2: mexc-wrapper.getKlines — 500 Mum Getir"]
    SCAN --> NORM["L2: normalizeSymbol — BTCUSDT formatına çevir"]
    NORM --> F4["L3: matrix-v5-engine.analyze — F4 Skor + bullWeight hesapla"]
    F4 --> MTF["L3: applyMtfScore — Zaman Dilimi Ağırlıkları"]
    MTF --> VETO1{"L4: pilot_only_holdings?"}
    VETO1 -->|EVET| HOLDCHECK{"Cüzdanda var mi?"}
    HOLDCHECK -->|HAYIR| BLOCK["🛑 VETO — Kapsam dışı"]
    HOLDCHECK -->|EVET| VETO2
    VETO1 -->|HAYIR| VETO2{"L4: isReEntryLimitReached?"}
    VETO2 -->|EVET| BLOCK2["🛑 VETO — Kota dolu"]
    VETO2 -->|HAYIR| VETO3{"L4: applyMtfVeto — NearestTF ters mi?"}
    VETO3 -->|TERS| BLOCK3["🛑 VETO — Mikro-trend direnci"]
    VETO3 -->|UYUMLU| DISPATCH["✅ L5: mexc-wrapper — TradingMode?"]
    DISPATCH -->|TEST| SIMPATH["L6A: trading-simulator.executeMarketBuy/Sell"]
    DISPATCH -->|PRODUCTION| REALPATH["L6B: mexc.ts — HMAC SHA256 imzalı POST /order"]
    SIMPATH --> FILLPRICE["L6: avgPrice Senkronu — TP/SL yeniden hesapla"]
    REALPATH --> FILLPRICE
    FILLPRICE --> SQLINSERT["L7: PostgreSQL — INSERT INTO orders STATUS FILLED"]
    SQLINSERT --> PUBSUB["L7: notifyFrontendChannel — PubSub emit"]
    PUBSUB --> HOOK["L7: React useTradingSignals — State yenile"]
    HOOK --> HEATMAP["L7: ActiveSmartTrades — bullWeight ile Isı Haritası"]

    classDef boot fill:#1a365d,stroke:#63b3ed,color:#fff;
    classDef math fill:#2d3748,stroke:#4fd1c5,color:#fff;
    classDef veto fill:#4a1212,stroke:#f56565,color:#fbb6ce;
    classDef dispatch fill:#b7791f,stroke:#f6e05e,color:#fff;
    classDef persist fill:#1c4532,stroke:#48bb78,color:#fff;
    class BOOT,MEM,SCAN,NORM boot;
    class F4,MTF math;
    class BLOCK,BLOCK2,BLOCK3,VETO1,VETO2,VETO3 veto;
    class DISPATCH,SIMPATH,REALPATH dispatch;
    class SQLINSERT,PUBSUB,HOOK,HEATMAP persist;
```

---

## 🔁 Bölüm 3: Aktif İşlem Döngüsü (Monitor Pipeline)

```mermaid
graph TD
    MCRON["/api/cron/trailing-stop — 1 sn döngü"] --> MMON["smart-trade-monitor.monitorSmartTrades"]
    MMON --> FETCH["SQL SELECT aktif orders — STATUS=OPEN"]
    FETCH --> PRICE["mexc-wrapper.getPrice — Anlık fiyat al"]
    PRICE --> EVAL["evaluateActiveTrade — TP/SL hesapla"]
    EVAL --> TSCHECK{"Trailing Stop aktif?"}
    TSCHECK -->|EVET| TRAIL["calculateTrailingExitTarget (trading-logic.ts)"]
    TSCHECK -->|HAYIR| STATICCHECK{"Statik TP veya SL Tetiklendi?"}
    TRAIL --> STATICCHECK
    STATICCHECK -->|TP HIT| TPEXEC["executePartialTP / executeExit — Kar Al"]
    STATICCHECK -->|SL HIT| SLEXEC["executeExit — Stop Loss"]
    STATICCHECK -->|BEKLE| AICHECK{"AI Analiz Zamanı?"}
    AICHECK -->|60sn| AIRUN["runAiAnalysis — matrix-v5-engine çalıştır"]
    AIRUN --> LOG["logSystemEvent — CombatLog güncelle"]
    TPEXEC & SLEXEC --> REGENTRY["registerPilotReEntry — Re-Entry Listesine ekle"]
    REGENTRY --> DBCLOSE["SQL UPDATE orders STATUS=CLOSED"]

    classDef mon fill:#2d3748,stroke:#4fd1c5,color:#fff;
    classDef run fill:#1c4532,stroke:#48bb78,color:#fff;
    class MMON,FETCH,PRICE,EVAL mon;
    class TPEXEC,SLEXEC,REGENTRY,DBCLOSE run;
```

---

## 🔔 Bölüm 4: Alarm Motoru ve Bildirim Akışı

```mermaid
graph TD
    ACRON["/api/cron/alarms — Zamanlanmış Tetik"] --> AENG["alarm-engine.checkAlarms"]
    AENG --> ASQL["SQL SELECT alarms WHERE is_active=true"]
    ASQL --> AGROUP["Kullanıcıya ve Sembole Göre Grupla"]
    AGROUP --> AKLINES["mexc-wrapper.getKlines — Mum verisi al"]
    AKLINES --> AV5["MatrixV5Engine.analyze — Sinyal üret"]
    AV5 --> ACOND{"Alarm Koşulu?"}
    ACOND -->|BUY_SIGNAL| AACT1["executeAlarmAction — NOTIFY"]
    ACOND -->|SELL_SIGNAL| AACT2["executeAlarmAction — AUTO TRADE"]
    ACOND -->|PRICE_ABOVE/BELOW| AACT3["executePanicSell — Panik Sat"]
    AACT1 & AACT2 & AACT3 --> ALOG["SQL INSERT alarm_logs"]

    classDef alarm fill:#4a1212,stroke:#f56565,color:#fbb6ce;
    class AENG,ASQL,AGROUP alarm;
```

---

## 🛡️ Bölüm 5: Güvenlik ve Kimlik Doğrulama (Auth Pipeline)

```mermaid
graph TD
    LOGIN["/api/auth/login — POST email+password"] --> AUTHUTIL["auth-utils.ts — bcrypt ile hash karşılaştır"]
    AUTHUTIL --> JWT["JWT Token üret — 24 saat geçerli"]
    JWT --> COOKIE["HttpOnly Cookie — TRADING_MODE embedded"]

    GREG["/api/auth/google — Google OAuth"] --> AUTHUTIL

    MEREQ["/api/auth/me — GET Kullanıcı"] --> VERIFYJWT["auth-utils.verifyJWT — Token doğrula"]
    VERIFYJWT -->|Geçersiz| UNAUTH["401 Unauthorized"]
    VERIFYJWT -->|Geçerli| USERINFO["SQL SELECT users"]
```

---

## 📊 Bölüm 6: Analytics ve Performans Akışı

```mermaid
graph TD
    ATODAYAPI["/api/analytics/today"] --> TODAYSQL["SQL SELECT orders WHERE date=TODAY"]
    TODAYSQL --> PNLCALC["PNL = Satış Fiyatı - Alış Fiyatı + Komisyon"]
    PNLCALC --> TODYRESP["JSON — Bugünün kârı, işlem sayısı"]

    ASYMAPI["/api/analytics/symbol/:sym"] --> SYMSQL["SQL SELECT orders WHERE symbol=:sym"]
    SYMSQL --> PERFCALC["Win Rate + Avg PNL Hesapla"]
    PERFCALC --> SYMRESP["JSON — Sembol bazlı istatistik"]

    SNAPCRON["/api/cron/portfolio-snapshot"] --> BALGET["mexc-wrapper.getHoldings — Bakiye çek"]
    BALGET --> SNAPDB["SQL INSERT portfolio_snapshots"]
```

---

## 💣 Bölüm 7: Panik Servis ve Emergency Pipeline

```mermaid
graph TD
    PANICAPI["/api/bot/emergency/panic"] --> PSVC["panic-service.executePanicSell"]
    PSVC --> GETACC["mexc-wrapper.getAccountInfo — Tüm bakiyeleri al"]
    GETACC --> SELLLOOP["Her Varlık İçin: marketSellByQty"]
    SELLLOOP -->|TEST| SIMPATH["trading-simulator.executeMarketSell"]
    SELLLOOP -->|PROD| REALPATH["mexc.ts — Gerçek Sat Emri"]
    SIMPATH & REALPATH --> SNAPSAVE["SQL INSERT panic_snapshots"]

    BUYBACK["/api/panic/buy-back"] --> REREQ["Seçilen varlıkları geri al"]
    REREQ --> MEXCWRAP["mexc-wrapper.marketBuyByQuote"]
```

---

## 🧩 Bölüm 8: Tüm Dosya Bağımlılık Tablosu

| Dosya                      | Konumu         | Bağımlı Olduğu                                         | Görevi                            |
| :------------------------- | :------------- | :----------------------------------------------------- | :-------------------------------- |
| `strategy-engine.ts`       | src/lib        | matrix-v5-engine, pilot-executor, db, mexc-wrapper     | Otopilot tarama döngüsü           |
| `matrix-v5-engine.ts`      | src/lib        | indicators, trade-utils                                | F4 + bullWeight AI motoru         |
| `pilot-executor.ts`        | src/lib        | db, mexc-wrapper, trade-utils                          | Veto zinciri + Emir kararı        |
| `smart-trade-monitor.ts`   | src/lib        | mexc-wrapper, smart-trade-execution, trading-logic, db | Aktif işlem takibi                |
| `smart-trade-execution.ts` | src/lib        | mexc-wrapper, db, pilot-executor.registerReEntry       | Emir yürütme (Entry/Exit)         |
| `trading-logic.ts`         | src/lib        | — (Pure Logic)                                         | F4Data tipleri, Trailing hesap    |
| `alarm-engine.ts`          | src/lib        | matrix-v5-engine, mexc-wrapper, panic-service, db      | Alarm kontrol döngüsü             |
| `panic-service.ts`         | src/lib        | mexc-wrapper, db, symbol-utils                         | Tüm portföyü sat                  |
| `mexc-wrapper.ts`          | src/lib        | mexc, trading-simulator, trading-mode                  | Test/Prod yönlendirici            |
| `mexc.ts`                  | src/lib        | — (External API)                                       | MEXC API sürücüsü (HMAC)          |
| `trading-simulator.ts`     | src/lib        | symbol-utils, db                                       | Sanal borsa simülatörü            |
| `trading-mode.ts`          | src/lib        | —                                                      | Test/Prod mod kontrolü            |
| `db.ts`                    | src/lib        | postgres                                               | Tüm SQL sorguları                 |
| `auth-utils.ts`            | src/lib        | db, jwt                                                | Kimlik doğrulama                  |
| `diagnostics.ts`           | src/lib        | db, mexc-wrapper                                       | Bot sağlık raporu                 |
| `trade-utils.ts`           | src/lib        | —                                                      | MTF Verdict, TP/SL yardımcıları   |
| `symbol-utils.ts`          | src/lib        | —                                                      | normalizeSymbol, extractBaseAsset |
| `indicators.ts`            | src/lib        | —                                                      | Teknik İndikatör formülleri       |
| `SignalScanner.ts`         | src/services   | mexc, db, strategies, mexc-wrapper                     | Sinyal tarayıcı sınıfı            |
| `api.ts`                   | src/services   | —                                                      | Frontend Axios istemcisi          |
| `useTradingSignals.ts`     | src/hooks      | api.ts                                                 | F4/MTF verisi için hook           |
| `usePortfolio.ts`          | src/hooks      | api.ts                                                 | Bakiye/Portföy için hook          |
| `useBotConfig.ts`          | src/hooks      | api.ts                                                 | Bot ayarları için hook            |
| `useCombatLogs.ts`         | src/hooks      | api.ts                                                 | Konsol logları için hook          |
| `ActiveSmartTrades.tsx`    | src/components | useTradingSignals, trading-logic                       | Aktif işlem tablosu               |
| `MatrixPortfolio.tsx`      | src/components | usePortfolio, trading-logic                            | Portföy arayüzü                   |
| `MatrixHorizon.tsx`        | src/components | useBotConfig                                           | Bot config paneli                 |
| `CombatLog.tsx`            | src/components | useCombatLogs                                          | Sistem konsolu                    |
| `SmartTrade.tsx`           | src/components | useSmartTradeLogic                                     | Manuel işlem paneli               |
| `IntelligenceHub.tsx`      | src/components | useWhaleRadar, useNewsData                             | Haber ve balina radar             |

---

## 🚥 Bölüm 9: Kritik Güvenlik Kapıları (Guard Rails)

| Kural              | Dosya                      | Tetikleyici                | Sonuç                               |
| :----------------- | :------------------------- | :------------------------- | :---------------------------------- |
| Singleton Tarayıcı | `strategy-engine.ts`       | `isScannerRunning=true`    | Çift tarama önlendi                 |
| Kapsam Filtresi    | `pilot-executor.ts`        | `pilot_only_holdings=true` | Cüzdan dışı sinyal bloklandı        |
| Re-Entry Normalize | `pilot-executor.ts`        | `normalizeSymbol()`        | BTC/USDT ≠ BTCUSDT hatası giderildi |
| MTF Veto           | `pilot-executor.ts`        | `NearestTF < threshold`    | Mikro-trend direnci →İptal          |
| Kota Koruması      | `pilot-executor.ts`        | `reEntryMap.size >= limit` | Kotayı aşan geri alımlar bloklandı  |
| Precision Guard    | `smart-trade-execution.ts` | `floor(qty * 1e8) / 1e8`   | Borsa "invalid qty" hatası önlendi  |
| Test/Prod Emniyet  | `mexc-wrapper.ts`          | `getTradingMode()`         | Gerçek para kazara harcanmadı       |

---

> [!IMPORTANT]
> **Mimari Özet:** Bu projenin tam veri döngüsü şu çizgide ilerler:
> `MEXC Piyasası → mexc-wrapper → matrix-v5-engine → pilot-executor → mexc-wrapper (dispatcher) → mexc.ts VEYA trading-simulator → db → PubSub → React UI`
>
> Projedeki yaklaşık 125 TS/TSX dosyasının %60'ı `src/lib` altındadır ve sistemin tüm zekası bu klasörde yaşar.
