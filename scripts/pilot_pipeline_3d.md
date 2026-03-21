# 🌌 Pilot Pipeline 3D Mimari Analizi

Bu doküman, sistemin "kalbi" olan **Pilot Pipeline**'ın (Otopilot İşlem Hattı) katmanlı mimarisini ve verinin bir sinyalden işleme nasıl dönüştüğünü 3 boyutlu bir perspektifle açıklar.

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

    subgraph "L4: EXECUTION LAYER (İnfaz Katmanı)"
        L --> M["🚀 SmartTrade Executor"]
        M --> N["🟢 BUY (New/Re-Entry)"]
        M --> O["🔴 SELL (Cover/TP/SL)"]
    end

    subgraph "L5: AUDIT LAYER (Denetim Katmanı)"
        N & O & I --> P["📋 Combat Terminal (YZ Sinyal Akışı)"]
        P --> Q["🔍 System Console (Derin Loglar)"]
    end

    style L1 fill:#1e293b,stroke:#334155,color:#cbd5e1
    style L2 fill:#0f172a,stroke:#38bdf8,color:#38bdf8,stroke-width:2px
    style L3 fill:#1e293b,stroke:#f59e0b,color:#f59e0b,stroke-width:2px
    style L4 fill:#064e3b,stroke:#10b981,color:#10b981,stroke-width:2px
    style L5 fill:#020617,stroke:#6366f1,color:#6366f1
```

## 🛠️ Pipeline Derinlik Analizi

### 1. Katman (Gözlem): Veri Toplama

Sistem, MEXC borsasından gelen ham mum (k-line) verilerini anlık olarak çeker. Bu katman, "Gözlem" katmanıdır ve sistemin dünyaya açılan penceresidir.

### 2. Katman (Zeka): Karar Mekanizması

En yoğun işlem bu katmanda gerçekleşir. Sadece tek bir indikatöre değil, **5 farklı zaman diliminin (MTF)** ve **AI Skoru**'nun konfluansına (kesişimine) bakılır. Sistem "akıllı" bir karar vermeden önce veriyi 360 derece analiz eder.

### 3. Katman (Güvenlik): İzolasyon Muhafızları

Burada veriler süzgeçten geçer:

- **Timeframe Guard:** Senin seçtiğin sidebar periyodu ile botun işlem periyodu burada ayrıştırılır. "İzleme" ve "Pilot" bu noktada kollara ayrılır.
- **Veto Guard:** Eğer MTF %65'in altındaysa veya AI skoru yetersizse, sinyal burada "VETO" yer.

### 4. Katman (İnfaz): Emir Pipeline'ı

Tüm onaylar alındıktan sonra, veri bir API isteğine dönüşür. **SmartTrade** motoru devreye girerek TP/SL ayarlarını yapar ve emri borsaya iletir.

### 5. Katman (Denetim): Görselleştirme

Son aşamada, tüm bu karmaşık süreç kullanıcının anlayabileceği "Şahane" sinyal kartlarına (`CombatLog`) dönüştürülür. İşlem başarılı olsa da olmasa da, denetim katmanı her adımı şeffafça loglar.

---

> [!IMPORTANT]
> Sistem şu an **Tam İzolasyon** modundadır. Kullanıcılar arası veri sızıntısı ve periyot karışıklığı bu pipeline sayesinde 0'a indirilmiştir.
