# 🌌 Pilot Pipeline 3D Mimari Analizi

Bu doküman, sistemin **Pilot Pipeline**'ının katmanlı mimarisini ve verinin bir sinyalden işleme nasıl dönüştüğünü 3 boyutlu bir perspektifle açıklar. Sistem, **TRADE (Long)** ve **COVER (Short)** üzerine kuruludur.

## 🏗️ Katmanlı Mimari Şeması (3D Perspective)

> [!NOTE]
> Aşağıdaki şema, sistemin dikey (vertically integrated) yapısını ve verinin derinliğini temsil eder.

```mermaid
graph TD
    subgraph "L1: SCANNER LAYER (Gözlem Katmanı)"
        A["📡 Market Scanner"] -->|Raw Data| B["🧹 Sanitize & Normalize"]
    end

    subgraph "L2: INTELLIGENCE LAYER (Zeka Katmanı)"
        B --> C["🧠 Matrix V5 Strategy"]
        C --> D["📊 MTF Consensus Analysis"]
        C --> E["⚡ F4 Power & Trend Check"]
        C --> F["🤖 AI Scoring Engine"]
    end

    subgraph "L3: GUARD LAYER (Güvenlik Katmanı)"
        D & E & F --> G["🛡️ Pilot Executor Guard"]
        G --> H{"⏰ Timeframe Isolation"}
        H -->|Mismatch| I["📝 Log Only (UI Visualization)"]
        H -->|Match| J{"💰 Capital Guard"}
        J -->|No Funds| K["⚠️ Allocation Error"]
        J -->|OK| L["✅ Veto Check (MTF/Score)"]
    end

    subgraph "L4: EXECUTION LAYER (Giriş Emri)"
        L --> M["🚀 SmartTrade Executor"]
        M --> N["🟢 TRADE — Long (Yeni Alım veya Re-Entry)"]
        M --> O["🔴 COVER — Short (Aktif Varlık Satışı)"]
        N & O --> TPADEF["📌 TP / SL Hedefleri TANIMLANIR ve SQL'e Kaydedilir"]
    end

    subgraph "L5: MONITOR LOOP (Sürekli İzleme — Ayrı Döngü)"
        TPADEF -.->|Her 1 saniyede tetiklenir| MON["🔁 smart-trade-monitor.ts"]
        MON --> EVAL["evaluateActiveTrade — Fiyat Kontrolü"]
        EVAL --> TP_CHECK{"TP Hedefine Ulaşıldı mı?"}
        EVAL --> SL_CHECK{"SL Tetiklendi mi?"}
        TP_CHECK -->|EVET| TP_EXEC["executePartialTP / executeExit — Kâr Al"]
        SL_CHECK -->|EVET| SL_EXEC["executeExit — Stop Loss"]
        TP_CHECK & SL_CHECK -->|Hayır| TRAIL{"Trailing Aktif?"}
        TRAIL -->|EVET| TRAIL_CALC["calculateTrailingExitTarget — Hedef Güncelle"]
    end

    subgraph "L6: AUDIT LAYER (Denetim Katmanı)"
        TP_EXEC & SL_EXEC & TRAIL_CALC & I --> P["📋 Combat Terminal (Sinyal Akışı)"]
        P --> Q["🔍 System Console (Derin Loglar)"]
    end

    style L1 fill:#1e293b,stroke:#334155,color:#cbd5e1
    style L2 fill:#0f172a,stroke:#38bdf8,color:#38bdf8,stroke-width:2px
    style L3 fill:#1e293b,stroke:#f59e0b,color:#f59e0b,stroke-width:2px
    style L4 fill:#064e3b,stroke:#10b981,color:#10b981,stroke-width:2px
    style L5 fill:#1c1917,stroke:#f97316,color:#f97316,stroke-width:2px
    style L6 fill:#020617,stroke:#6366f1,color:#6366f1
```

---

## 🛠️ Pipeline Derinlik Analizi

### 1. Katman (Gözlem): Veri Toplama

Sistem, MEXC borsasından gelen ham mum (k-line) verilerini anlık olarak çeker. Bu katman, "Gözlem" katmanıdır ve sistemin dünyaya açılan penceresidir.

### 2. Katman (Zeka): Karar Mekanizması

En yoğun işlem bu katmanda gerçekleşir. Sadece tek bir indikatöre değil, **5 farklı zaman diliminin (MTF)** ve **AI Skoru**'nun konfluansına (kesişimine) bakılır.

### 3. Katman (Güvenlik): İzolasyon Muhafızları

- **Timeframe Guard:** İzleme ve Pilot periyotları burada ayrıştırılır.
- **Veto Guard:** MTF skoru veya AI skoru yetersizse sinyal burada **VETO** alır.

### 4. Katman (Giriş Emri): TRADE ve COVER Mimarisi

> [!IMPORTANT]
> Sistem **Long/Short** değil, **TRADE (Long)** ve **COVER (Short)** terminolojisiyle çalışır.

- **🟢 TRADE (Long):** Yeni varlık alımı veya Re-Entry (Geri Alım). TP / SL parametreleri **tanımlanıp** SmartTrade kaydına yazılır. Ancak burada **çalıştırılmaz.**
- **🔴 COVER (Short):** Portföydeki varlığın kısa pozisyona alınması. TP / SL parametreleri yine **tanımlanır, çalıştırılmaz.**

### 5. Katman (Monitor Loop): TP/SL'nin Gerçekten Tetiklendiği Yer

> [!CAUTION]
> TP ve SL **Giriş emri sırasında değil**, `smart-trade-monitor.ts` döngüsünde **her saniye** kontrol edilerek tetiklenir.

- `evaluateTakeProfit()` → Fiyat TP hedefine ulaştıysa → `executePartialTP` veya `executeExit`
- `evaluateStopLoss()` → Fiyat SL hedefine düştüyse → `executeExit`
- `calculateTrailingExitTarget()` → Trailing aktifse hedef dinamik olarak güncellenir.

### 6. Katman (Denetim): CombatLog Görselleştirme

Her işlem, her veto ve her kapanış — başarılı olsun ya da olmasın — `CombatLog`'a yazılır.

---

> [!NOTE]
> **Özet:** Giriş emirleri (L4) sadece karar verir ve kaydeder. TP/SL'nin gerçekleşmesi tamamen bağımsız bir `cron` döngüsünde (L5) yaşar. Bu tasarım, botun aynı anda onlarca işlemi eş zamanlı takip edebilmesini sağlar.
