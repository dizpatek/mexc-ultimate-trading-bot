# 🧠 Matrix F4 Ultimate V3 – Kullanıcı Kılavuzu

> **Versiyon:** 3.0 – MTF Engine + AI Score 10x + Bayesian Tracker  
> **Platform:** TradingView – Pine Script v6  
> **Mod:** Indicator (Overlay)

---

## 📋 İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Kurulum](#2-kurulum)
3. [Ana Modüller](#3-ana-modüller)
4. [Input Ayarları (Settings)](#4-input-ayarları)
5. [Dashboard Paneli](#5-dashboard-paneli)
6. [Sinyal Sistemi](#6-sinyal-sistemi)
7. [Alarm Kurulumu](#7-alarm-kurulumu)
8. [Strateji Mantığı](#8-strateji-mantığı)
9. [Sık Sorulan Sorular (SSS)](#9-sık-sorulan-sorular)
10. [Sorun Giderme](#10-sorun-giderme)

---

## 1. Genel Bakış

Matrix F4 Ultimate V3, **9 ana katmandan** oluşan profesyonel bir trading indikatörüdür:

```
┌─────────────────────────────────────────┐
│         META EXECUTION GATE             │  ← Son karar
├─────────────────────────────────────────┤
│  Cross-Asset │ Time-Decay │ Bayesian   │  ← Filtreler
├─────────────────────────────────────────┤
│  Capital Engine │ Regime Prediction     │  ← Sermaye
├─────────────────────────────────────────┤
│  MTF Trend Engine │ Volatilite Rejimi  │  ← V3 Mühendislik
├─────────────────────────────────────────┤
│  Market Regime │ AI Score (10x)        │  ← Rejim + AI
├─────────────────────────────────────────┤
│         WHALE MASTER ENGINE             │  ← Balina tespiti
├─────────────────────────────────────────┤
│   F4 Strategy │ WaveTrend │ SMC/OB     │  ← Teknik analiz
├─────────────────────────────────────────┤
│  ChartPrime Channels │ LuxAlgo Lines   │  ← Trend kanalları
└─────────────────────────────────────────┘
```

### Ne Yapar?

- 📈 **Trend tespiti** (F4 + Fibonacci + SMC yapısı)
- 🐋 **Balina aktivitesi** izleme (hacim proxy ile)
- 🧠 **AI Güven Skoru** (0-100, 10 bileşenli)
- 🌍 **Piyasa rejimi** belirleme (Risk-ON / Risk-OFF)
- 📡 **Cross-asset radar** (BTC→ALT para akışı)
- 📶 **Çok Zaman Dilimli Trend** (Günlük, 4H, 1H, 15dk eğim analizi)
- ⚡ **Momentum İvme** (2. türev – hızlanıyor mu yavaşlıyor mu?)
- 📊 **Volatilite Rejimi** (Sıkıştırma / Patlama / Yüksek Vol)
- 📐 **Z-Score** (ortalamaya dönüş dedektörü)
- 🎯 **Bayesian Win Rate** (sinyal kazanma oranı takibi)
- ⏱ **Sinyal tazeliği** takibi (geç sinyal = çürük sinyal)
- 🛡️ **Kill switch** (ardışık kayıp koruması)
- ✅ **Tek bir SİSTEM KARARI** ile işlem izni

## 1.1 🌐 Bridge Eklentisi Kurulumu (GEREKLİ)

TradingView Pro özelliklerinin ve oturumunun korunması için **Matrix Bridge** eklentisini kurmanız gerekmektedir:

1. Dashboard'da **Pro Chart V3** yanındaki uyarıya tıklayın veya Giriş Paneline gidin.
2. **EKLENTİYİ İNDİR (.ZIP)** butonuna basarak dosyayı indirin.
3. İndirdiğiniz `.zip` dosyasını bir klasöre çıkarın.
4. Tarayıcınızda (Chrome/Edge/Opera) `Ayarlar > Uzantılar` sayfasını açın.
5. Sağ üstteki **Geliştirici Modu**'nu aktif hale getirin.
6. **Paketlenmiş öğe yükle** butonuna basarak çıkardığınız klasörü seçin.
7. Eklenti kurulduğunda dashboard üzerinde **"BRIDGE AKTİF"** yazısı görünecektir.

---

## 2. Kurulum

### Adım 1: Kodu TradingView'e Ekle

1. TradingView'da **Pine Editor** aç
2. `MatrixV2.txt` içeriğini tamamıyla yapıştır
3. **"Add to Chart"** butonuna tıkla

### Adım 2: Zaman Dilimi Seçimi

| Mod       | Önerilen Zaman Dilimi |
| --------- | --------------------- |
| **Scalp** | 1m, 3m, 5m, 15m       |
| **Swing** | 1H, 4H, 1D            |

### Adım 3: Sembol Ayarı

- **Kripto:** BTCUSDT, ETHUSDT, vb.
- **Cross-Asset Radar** otomatik olarak `BINANCE:BTCUSDT` verilerini çeker
- Altcoin'lerde BTC akışı kontrol edilir

---

## 3. Ana Modüller

### 3.1 🎯 F4 Stratejisi

Ana trend belirleme motoru. İç içe EMA katmanlarından oluşur.

- **F4 Ana Çizgi:** Trend yönünü gösterir (yeşil = yükseliş, kırmızı = düşüş)
- **F4 Fibonacci Çizgisi:** Daha hassas sinyal üretir
- **AL/SAT Etiketleri:** F4 yön değişimlerinde otomatik oluşur

### 3.2 📊 Akıllı Para Kavramları (SMC)

- **Trend Devamı (BOS):** Mevcut trendin devam ettiğini gösterir.
- **Trend Dönüşü (CHoCH):** Trendin yön değiştirdiği noktaları gösterir.
- **Sipariş Blokları (OB):** Kurumsal alım/satım bölgeleri
- **Adil Değer Aralıkları (FVG):** Fiyat boşlukları
- **Güçlü / Zayıf Tepe ve Dipler:** Fiyatın önemli dönüş noktalarını işaretler.
- **Eşit Zirve/Dip:** Likidite havuzları

### 3.3 🐋 Whale Master Engine (YENİ)

Balinaların borsadaki izini hacim analizi ile tespit eder.

| Tespit             | Açıklama                                     |
| ------------------ | -------------------------------------------- |
| **Balina Hacim**   | Hacim > Ortalama × Katsayı (varsayılan 2.5x) |
| **Balina Alım**    | Yüksek hacim + yeşil mum + pozitif delta     |
| **Balina Satım**   | Yüksek hacim + kırmızı mum + negatif delta   |
| **Fake Breakout**  | Balina hacmi + fitil bırakma + geri dönüş    |
| **Gerçek Birikim** | Balina hacmi + fiyat uçmuyor + destek        |

#### 3 Şart Kuralı (Zorunlu)

İşlem açılması için **3 koşulun birlikte** sağlanması gerekir:

1. ✅ Balina teyidi (hacim + yön)
2. ✅ Teknik seviye (destek/direnç yakınlığı)
3. ✅ Tuzak olmaması (fake breakout değil)

> ❌ **Tek başına balina = İŞLEM YOK!**

### 3.4 🧠 AI Güven Skoru (0-100) – V3 Gelişmiş

Tüm koşulları **10 bileşenli** ağırlıklı bir skora dönüştürür:

| Bileşen                     | Puan    | Koşul                                     |
| --------------------------- | ------- | ----------------------------------------- |
| **TEMEL BİLEŞENLER**        |         |                                           |
| Balina Teyidi               | +15     | whaleBuyConfirmed veya whaleSellConfirmed |
| Rejim Uyumu                 | +15     | Risk-ON + Buy veya Risk-OFF + Sell        |
| Hacim Gücü                  | +10     | Whale volume aktif                        |
| Trend Uyumu                 | +10     | EMA50 > EMA200 + Buy (veya tersi)         |
| **MÜHENDİSLİK BİLEŞENLERİ** |         |                                           |
| MTF Konsensüs               | +15     | 4+ zaman dilimi aynı yönde                |
| Momentum İvme               | +10     | Eğim + ivme aynı yönde                    |
| Volatilite Rejimi           | +10     | Sıkıştırma veya Patlama                   |
| Z-Score                     | +10     | Aşırı alım/satım bölgesi                  |
| Bayesian Win Rate           | +5      | Geçmiş kazanma oranı > %60                |
| **CEZA**                    |         |                                           |
| Tuzak Cezası                | **-15** | Fake breakout tespit edilmişse            |

- **65+ puan:** İşlem izni var ✅
- **40-64 puan:** Dikkatli ol ⚠️
- **0-39 puan:** İşlem yasak ❌

> 💡 Min AI Skoru ayarlardan değiştirilebilir (varsayılan: 65)

### 3.5 🌍 Market Regime Engine

Piyasanın makro durumunu belirler:

| Rejim        | Koşul                                            | Anlamı           |
| ------------ | ------------------------------------------------ | ---------------- |
| **RISK_ON**  | Trend yukarı + düşük volatilite + DOM düşüyor    | Long açılabilir  |
| **RISK_OFF** | Trend aşağı + yüksek volatilite + DOM yükseliyor | Short açılabilir |
| **NEUTRAL**  | Karışık sinyaller                                | İşlem yapma      |

### 3.6 📡 Regime Prediction (İvme Tabanlı – V3)

Piyasa rejimini **momentum ivmesi** kullanarak tahmin eder:

| Tahmin                  | Anlamı                             | Aksiyon          |
| ----------------------- | ---------------------------------- | ---------------- |
| **HIZLANAN_TREND** 🚀   | Trend hızlanıyor (eğim ↑ + ivme ↑) | Pozisyonu koru   |
| **YAVAŞLAYAN_TREND** ⚠️ | Trend yavaşlıyor (eğim ↑ + ivme ↓) | Dikkatli ol      |
| **HIZLANAN_DÜŞÜŞ** 💀   | Düşüş hızlanıyor (eğim ↓ + ivme ↓) | Short veya bekle |
| **DİP_ARAYIŞI** 🔄      | Dip oluşuyor (eğim ↓ + ivme ↑)     | Alışa hazırlan   |
| **PRE_EXPLOSION**       | Sıkıştırma → patlama yakın         | Dikkatli bekle   |
| **RANGE**               | Yatay piyasa                       | İşlem YAPMA      |
| **TRANSITION**          | Geçiş dönemi                       | İzle             |

### 3.7 💰 Capital & Attention Engine

Sermayeni nereye yönlendireceğini belirler:

| Faz                | Asset Score | Anlamı                    |
| ------------------ | ----------- | ------------------------- |
| **PRIMARY_FLOW**   | > 2.0       | Ana para akışı burada     |
| **SECONDARY_FLOW** | > 1.4       | İkincil ilgi              |
| **ROTATION**       | > 1.1       | Rotasyon                  |
| **NO_CAPITAL**     | ≤ 1.1       | Sermaye yok → İşlem yapma |

### 3.8 📡 Cross-Asset Capital Radar

BTC'deki para akışını izleyerek altcoin sinyallerini filtreler:

- **BTC Volume Impulse:** BTC hacmi ortalamanın 1.5x üzerinde mi?
- **BTC Price Accept:** BTC fiyatı EMA20 üzerinde mi?
- Her ikisi de **EVET** → ALT sinyali geçerli ✅
- Biri bile **HAYIR** → ALT sinyali iptal ❌

> 📌 BTC'de para yoksa → Altcoin'de sinyal **yok sayılır**

### 3.9 ⏱ Time-Decay Alpha

Sinyalin oluşmasından itibaren geçen süreyi izler:

| Bar Sayısı | Decay Faktör | Durum         |
| ---------- | ------------ | ------------- |
| 0-1 bar    | 1.0 (100%)   | TAZE ⏱        |
| 2-3 bar    | 0.7 (70%)    | Yaşlanıyor ⏳ |
| 4-5 bar    | 0.4 (40%)    | Zayıflıyor    |
| 5+ bar     | 0.0 (0%)     | ÇÜRÜMÜŞ ❌    |

> "Biraz geç ama alayım" → **Bu artık mümkün değil!**

### 3.10 🛡️ Koruma Mekanizmaları

#### Kill Switch

- Ardışık kayıp sayısı belirlenen limite ulaşırsa (varsayılan: 6)
- Sistem **otomatik olarak durur** 🛑
- Daha fazla kayıp engellenir

#### System Fatigue (Overtrading Koruması)

- Çok sık sinyal üretiliyorsa
- Sistem **dinlenme moduna** geçer 💤
- Overtrading'den korur

#### Self-Pruning + Bayesian Tracker (V3)

- Her modülün bir **güven skoru** vardır
- Kazançlarda skor artar (+0.05)
- Kayıplarda skor düşer (-0.10)
- Skor 0.3'ün altına düşerse → modül **otomatik kapanır**
- **V3 Yenilik:** Sinyaller 10 bar sonra doğrulanır ve kazanma oranı hesaplanır
- Dashboard'da **Kazanma Oranı: %X** olarak görünür

---

## 4. Input Ayarları

### Global Mod

| Ayar       | Varsayılan | Açıklama                |
| ---------- | ---------- | ----------------------- |
| Trade Modu | Scalp      | Scalp veya Swing        |
| F4 Durumu  | Aktif      | F4 stratejisini aç/kapa |

### F4 Stratejisi

| Ayar          | Scalp | Swing | Açıklama               |
| ------------- | ----- | ----- | ---------------------- |
| F4 Uzunluğu   | 3     | 10    | EMA periyodu           |
| Hacim Faktörü | 0.7   | 4.2   | Alpha katsayısı        |
| Fibo Uzunluğu | 5     | 8     | Fibonacci EMA periyodu |
| Fibo Faktörü  | 0.618 | 0.618 | Fibonacci alpha        |

### Balina Motoru (Whale Engine)

| Ayar                       | Varsayılan | Açıklama                  |
| -------------------------- | ---------- | ------------------------- |
| Whale Engine Aktif         | ✅         | Motoru aç/kapa            |
| Balina Hacim Katsayısı     | 2.5        | Hacim × bu değer = balina |
| Balina Grafiklerini Göster | ✅         | Chart üzerinde göster     |

> 💡 **Katsayı ne kadar yüksekse**, o kadar az ama güçlü sinyal gelir. Başlangıç için **2.5** idealdir.

### Piyasa Rejimi & AI

| Ayar         | Varsayılan | Açıklama                      |
| ------------ | ---------- | ----------------------------- |
| Min AI Skoru | 65         | Bu skorun altında işlem yasak |

> 💡 **Agresif:** 50 | **Normal:** 65 | **Muhafazakâr:** 80

### Sermaye & Yürütme Motoru

| Ayar                  | Varsayılan | Açıklama                       |
| --------------------- | ---------- | ------------------------------ |
| Sinyal Tazelik Süresi | 5 bar      | Bu kadar bar sonra sinyal ölür |
| Max Ardışık Kayıp     | 6          | Kill switch limiti             |

---

## 5. Dashboard Paneli

Dashboard sağ üst köşede **3 sütunlu** (İkon | Parametre | Değer) modern bir panele dönüştürüldü. Artık teknik terimler yerine **anlam odaklı (sentiment)** Türkçe ifadeler kullanılıyor.

### Bölüm 1: Teknik Analiz (Row 0-5)

| İkon | Parametre      | Olası Durumlar                               |
| ---- | -------------- | -------------------------------------------- |
| ⚡   | **MOD**        | SCALP / SWING                                |
| 📊   | **Yapı (SMC)** | Boğa Trendi / Ayı Trendi / Yatay             |
| 📈   | **F4 Eğilimi** | 🟢 Yükseliyor / 🔴 Düşüyor                   |
| 🔹   | **Fibo Trend** | 🟢 Yükseliyor / 🔴 Düşüyor                   |
| 🌊   | **Momentum**   | Momentum Artıyor / Tepede (Sat) / Dipte (Al) |
| 🔀   | **Uyumsuzluk** | Pozitif (Dönüş) / Negatif (Dönüş) / Yok      |

### Bölüm 2: Piyasa Verileri (Row 6-10)

| İkon | Parametre        | Açıklama                                    |
| ---- | ---------------- | ------------------------------------------- |
| ₿    | **BTC.DOM**      | Bitcoin dominansı ve günlük değişimi        |
| Ξ    | **ETH.DOM**      | Ethereum dominansı                          |
| 💲   | **USDT.DOM**     | Teter dominansı (Yükselmesi = Nakite kaçış) |
| 🔄   | **Piyasa Akışı** | Altcoin Sezonu / Nakite Kaçış / BTC Öncü    |

### Bölüm 3: Whale Engine & Karar (Row 11-21)

| İkon | Parametre           | Durumlar & Anlamları                                          |
| ---- | ------------------- | ------------------------------------------------------------- |
| 🐋   | **Balina Durumu**   | Ralli Hazırlığı / Dağıtım / Tuzak                             |
| 🌍   | **Piyasa Rejimi**   | 🟢 Long Uygun / 🔴 Short Uygun / ⚪ Bekle                     |
| 🧠   | **AI Güven Skoru**  | 0-100 arası (10 bileşenli, 75+ Süper)                         |
| 🔮   | **Gelecek Tahmin**  | Hızlanan Trend 🚀 / Yavaşlıyor ⚠️ / Düşüş 💀 / Dip Arayışı 🔄 |
| 💰   | **Sermaye Yönü**    | Ana Akış (Güçlü) / İkincil Akış / Para Yok ❌                 |
| 📡   | **BTC Onayı**       | ✅ BTC Akış Var / ❌ BTC Akışı Yok                            |
| ⏱    | **Sinyal Tazeliği** | Taze ⏱ / Eskiyor ⏳ / Geç Kaldın ❌                           |
| 🐋   | **Balina Tipi**     | Gerçek Balina 🐳 / Fake Balina ⚠️                             |
| 🔧   | **Modül Sağlığı**   | Aktif (skor) / Devre Dışı ❌                                  |
| 🛡   | **Koruma Kalkanı**  | AÇIK ✅ / DİNLEN 💤 / DURDU 🛑                                |

### Bölüm 4: Mühendislik Analizi (Row 22-27) – 🆕 V3

| İkon | Parametre            | Durumlar & Anlamları                                      |
| ---- | -------------------- | --------------------------------------------------------- |
| 📶   | **MTF Uzlaşı (X/5)** | GÜÇLÜ YÜKSELİŞ / DÜŞÜŞ / KARIŞIK                          |
| ⚡   | **Momentum İvme**    | Hızlanıyor 🚀 / Yavaşlıyor ⚠️ / Çöküş 💀 / Dip Oluşumu 🔄 |
| 📊   | **Volatilite**       | SIKIŞTIRMA / PATLAMA / YÜKSEK VOL / NORMAL                |
| 📐   | **Z-Skor**           | AŞIRI ALIM / PAHALI / NORMAL / UCUZ / AŞIRI SATIM         |
| 🎯   | **Kazanma Oranı**    | %X (>%55 iyi) / Veri Yok (yeterli sinyal bekleniyor)      |

### Bölüm 5: Final Karar (Row 28-29)

| İkon | Parametre         | Durumlar                                      |
| ---- | ----------------- | --------------------------------------------- |
| ⚡   | **SİSTEM KARARI** | 🟢 **İŞLEM AÇ ✅** / 🔴 **BEKLE ❌**          |
| 🤖   | **YZ Önerisi**    | RALLİ MODU 🔥 / DİP DÖNÜŞÜ / TREND YÖNÜNDE AL |

---

## 6. Sinyal Sistemi

### Chart Üzerindeki İşaretler

| İşaret                   | Görünüm           | Anlam              |
| ------------------------ | ----------------- | ------------------ |
| **AL** (yeşil etiket)    | Altta, label up   | F4 alış sinyali    |
| **SAT** (kırmızı etiket) | Üstte, label down | F4 satış sinyali   |
| **🐋** (aqua elmas)      | Altta             | Whale onaylı LONG  |
| **🐋** (fuşya elmas)     | Üstte             | Whale onaylı SHORT |
| **✕** (turuncu çarpı)    | Üstte             | Fake whale uyarısı |
| **✅** (yeşil)           | Üst panel         | Sistem izni var    |
| **🛑** (kırmızı)         | Üst panel         | Kill switch aktif  |

### Sinyal Hiyerarşisi

```
F4 Sinyali (AL/SAT)
    ↓
Whale Engine Filtresi
    ↓ (3 şart + tuzak yok)
AI Güven Skoru ≥ 65?
    ↓
Rejim Uyuyor mu? (RISK_ON → Long / RISK_OFF → Short)
    ↓
Cross-Asset İzni Var mı? (BTC akışı)
    ↓
Sinyal Taze mi? (time-decay)
    ↓
Modül Sağlıklı mı? (self-pruning)
    ↓
Kill Switch Aktif Değil mi?
    ↓
Overtrading Yok mu?
    ↓
✅ SİSTEM KARARI → İŞLEM AÇILABİLİR
```

> ⚠️ **Herhangi bir katman HAYIR derse → İşlem YOK!**

---

## 7. Alarm Kurulumu

### Mevcut Alarmlar (19 adet)

- F4 ALIŞ / F4 SATIŞ
- LuxAlgo Kırılım (Yukarı/Aşağı)
- SMC yapı alarmları (BOS, CHoCH)
- Sipariş bloğu kırılımları
- Eşit Zirve/Dip, FVG

### Yeni Whale Engine Alarmları (11 adet)

| Alarm                | Tetiklenme                            | Önem          |
| -------------------- | ------------------------------------- | ------------- |
| **Whale Long**       | Balina onaylı long + AI skor yeterli  | 🔴 Çok Yüksek |
| **Whale Short**      | Balina onaylı short + AI skor yeterli | 🔴 Çok Yüksek |
| **Balina Tuzak**     | Fake breakout tespit                  | 🟡 Yüksek     |
| **Gerçek Balina**    | Real whale aktivitesi                 | 🟡 Yüksek     |
| **Fake Balina**      | Likidite avcısı tespit                | 🟠 Orta       |
| **Sistem İzni**      | Tüm koşullar sağlandı                 | 🔴 Çok Yüksek |
| **Kill Switch**      | Ardışık kayıp limiti aşıldı           | 🔴 Kritik     |
| **Rejim Değişimi**   | Piyasa rejimi değişti                 | 🟡 Yüksek     |
| **AI Skor Yükseldi** | Skor eşiği geçti                      | 🟠 Orta       |
| **AI Skor Düştü**    | Skor eşiğin altına düştü              | 🟡 Yüksek     |

### Alarm Nasıl Kurulur?

1. TradingView'da indikatör → sağ tık → **"Add Alert"**
2. Condition → "Matrix F4 Ultimate" seç
3. İstediğin alarmı seç (ör: "Whale Long")
4. Notification: Push, Email, Webhook, vb.

### Önerilen Alarm Seti

**Başlangıç için bu 5 alarmı kur:**

1. ✅ **Whale Long** – Ana long sinyali
2. ✅ **Whale Short** – Ana short sinyali
3. ✅ **Kill Switch** – Koruma alarmı
4. ✅ **Rejim Değişimi** – Piyasa değişimi
5. ✅ **Balina Tuzak** – Tuzak uyarısı

---

## 8. Strateji Mantığı

### İşlem Açma Kuralları

#### LONG (Alış) Koşulları:

```
✅ Balina alım teyidi (hacim + yön + destek)
✅ Fake breakout YOK
✅ Ralli fazı aktif
✅ AI Skor ≥ 65
✅ Rejim = RISK_ON
✅ Rejim tahmini ≠ RANGE
✅ Sermaye fazı ≠ NO_CAPITAL
✅ BTC akışı VAR
✅ Sinyal taze (5 bar içinde)
✅ Modül sağlıklı
✅ Kill switch kapalı
✅ Overtrading yok
```

#### SHORT (Satış) Koşulları:

```
✅ Balina satım teyidi (hacim + yön + direnç)
✅ Fake breakout YOK
✅ Dağıtım fazı aktif
✅ AI Skor ≥ 65
✅ Rejim = RISK_OFF
✅ Rejim tahmini ≠ RANGE
✅ Sermaye fazı ≠ NO_CAPITAL
✅ BTC akışı VAR
✅ Sinyal taze (5 bar içinde)
✅ Modül sağlıklı
✅ Kill switch kapalı
✅ Overtrading yok
```

### Score Sisteminin Doğru Okunması

Dashboard'daki **SİSTEM KARAR** satırı **en kritik** bilgidir:

- 🟢 **İŞLEM İZNİ VAR ✅** → Tüm filtreler geçildi, sinyal güvenilir
- 🔴 **İŞLEM YASAK ❌** → En az bir filtre başarısız, bekle

### Günlük Çalışma Rutini

1. **Grafiği aç** → Dashboard'a bak
2. **REJİM** kontrol et → RISK_ON / RISK_OFF / NEUTRAL
3. **AI SKOR** kontrol et → 65+ mı?
4. **BALİNA** kontrol et → Aktif mi?
5. **SİSTEM KARAR** kontrol et → İzin var mı?
6. İzin varsa → F4 sinyallerini takip et
7. İzin yoksa → **HİÇBİR ŞEY YAPMA**

---

## 9. Sık Sorulan Sorular

### S: Whale Engine'i kapatabilir miyim?

**C:** Evet. Settings → Balina Motoru → "Whale Engine Aktif" kapatın. F4 + SMC normal çalışmaya devam eder.

### S: SİSTEM KARAR sürekli YASAK gösteriyor, ne yapmalıyım?

**C:** Bu normaldir. Sistem çoğu zaman **işlem yapmamanızı** söyleyecektir. Bu sizi koruyor. Beklemeyi öğrenin.

### S: AI Skoru hiç 65'e ulaşmıyor?

**C:** Min AI Skoru değerini düşürün (ör: 50). Ancak bu daha fazla risk demektir.

### S: Cross-Asset sürekli "BTC AKIŞ YOK" gösteriyor?

**C:** BTC düşük hacimde veya trend altındaysa bu normaldir. BTC canlanınca ALT sinyalleri otomatik açılır.

### S: Kill Switch devreye girdi, ne yapmalıyım?

**C:** Bir süre bekleyin. Başarılı sinyallerle ardışık kayıp sayacı sıfırlanacak ve sistem otomatik açılacaktır.

### S: Scalp mı Swing mi kullanmalıyım?

**C:**

- **Scalp:** 1m-15m grafiklerde, sık sinyal, hızlı giriş/çıkış
- **Swing:** 1H-1D grafiklerde, az sinyal, büyük hedefler

### S: Hangi coinlerde kullanmalıyım?

**C:** Yüksek hacimli coinlerde en iyi sonuç verir: BTC, ETH, SOL, BNB, XRP. Düşük hacimli altcoin'lerde balina tespiti daha az güvenilirdir.

### S: Bu indikatör beni zengin eder mi?

**C:** Hayır. Bu sistem **aptalca işlemleri engeller** ve işlem kalitenizi artırır. Kazanç, **işlem yapmayarak** kazanmaktan gelir.

---

## 10. Sorun Giderme

### "Source is not available" Hatası

- Bazı borsalarda `BINANCE:BTCUSDT` verisi olmayabilir
- Çözüm: Cross-asset radar için farklı bir borsa sembolü gerekebilir

### Dashboard Görünmüyor

- Settings → "Gelişmiş Paneli Göster" açık mı kontrol edin
- Grafik üzerinde yer olmayabilir → zoom out yapın

### Çok Fazla / Az Sinyal

- **Çok fazla:** Whale Hacim Katsayısını artırın (ör: 3.0)
- **Çok az:** AI Skor eşiğini düşürün (ör: 50) veya Katsayıyı düşürün (ör: 2.0)

### request.security Uyarısı

- TradingView bazen `request.security` için uyarı verebilir
- Bu normal çalışmayı etkilemez (lookahead kullanılıyor)

---

## 📊 Hızlı Referans Kartı

```
╔════════════════════════════════════════════╗
║          MATRIX F4 ULTIMATE V3             ║
╠════════════════════════════════════════════╣
║                                            ║
║  🟢 İŞLEM AÇ:                             ║
║  ├─ SİSTEM KARAR = İZİN VAR ✅            ║
║  ├─ AI SKOR ≥ 65 (10 bileşen)              ║
║  ├─ MTF Uzlaşı = YÜKSELİŞ                 ║
║  ├─ Momentum = HIZLANIYOR 🚀              ║
║  ├─ REJİM = RISK_ON (long) / OFF (short)  ║
║  └─ F4 sinyali + Whale teyidi              ║
║                                            ║
║  🔴 BEKLE:                                 ║
║  ├─ SİSTEM KARAR = YASAK ❌               ║
║  ├─ MTF Uzlaşı = KARIŞIK                  ║
║  ├─ Momentum = ÇÖKÜŞ 💀                  ║
║  ├─ Volatilite = YÜKSEK VOL               ║
║  ├─ CROSS-ASSET = BTC akış yok             ║
║  └─ KILL SWITCH aktif                      ║
║                                            ║
║  🔬 V3 MÜHENDİSLİK:                       ║
║  ├─ MTF (5 TF) = Çok zaman dilimli trend   ║
║  ├─ İvme = 2. türev (hız değişimi)        ║
║  ├─ Z-Skor = Ortalamaya dönüş             ║
║  ├─ Volatilite = BB + ATR z-score          ║
║  └─ Bayesian = Sinyal kazanma oranı         ║
║                                            ║
╘════════════════════════════════════════════╝
```

---

> **⚠️ YASAL UYARI:** Bu indikatör yatırım tavsiyesi değildir. Tüm işlemler kendi sorumluluğunuzdadır. Geçmiş performans gelecek sonuçları garanti etmez.

---

_Matrix F4 Ultimate V3 – Kullanıcı Kılavuzu_  
_Son Güncelleme: 2026-02-11_
