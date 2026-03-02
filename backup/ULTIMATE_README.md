# 🧠 Matrix F4 Ultimate – NIHAI MASTER GUIDE (Birleştirilmiş Tüm Dökümanlar)

> **Versiyon:** 4.0 – MTF Engine + AI Score 10x + SmartTrade + Technical Specs  
> **Platform:** TradingView & MexC Automation Dashboard  
> **Durum:** ✅ ÜRETİME HAZIR (PRODUCTION READY)

Bu dosya, projedeki tüm kullanıcı kılavuzlarını, teknik uygulama detaylarını ve sistem mimarisini içeren nihai, tek dökümandır.

---

## 📋 İçindekiler (Hızlı Erişim)

1. [Kullanıcı Kılavuzu (Matrix F4 V3)](#-matrix-f4-ultimate-v3--kullanıcı-kılavuzu)
2. [SmartTrade Uygulama Detayları (3Commas Uyumluluk)](#smarttrade-implementation---3commas-compatibility)
3. [Uygulama Tamamlanma Raporu (Teknik İstatistikler)](#-mexc-ultimate-trading-bot---implementation-complete)
4. [Hızlı Başlangıç Rehberi (User Guide)](#-mexc-ultimate-trading-bot---user-guide)

---

# 🧠 Matrix F4 Ultimate V3 – Kullanıcı Kılavuzu

> **Versiyon:** 3.0 – MTF Engine + AI Score 10x + Bayesian Tracker  
> **Platform:** TradingView – Pine Script v6  
> **Mod:** Indicator (Overlay)

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

---

## 3. Ana Modüller

### 3.1 🎯 F4 Stratejisi

Ana trend belirleme motoru. İç içe EMA katmanlarından oluşur.

- **F4 Ana Çizgi:** Trend yönünü gösterir (yeşil = yükseliş, kırmızı = düşüş)
- **F4 Fibonacci Çizgisi:** Daha hassas sinyal üretir

### 3.2 📊 Akıllı Para Kavramları (SMC)

- **Trend Devamı (BOS):** Mevcut trendin devam ettiğini gösterir.
- **Trend Dönüşü (CHoCH):** Trendin yön değiştirdiği noktaları gösterir.
- **Sipariş Blokları (OB):** Kurumsal alım/satım bölgeleri
- **Adil Değer Aralıkları (FVG):** Fiyat boşlukları

### 3.3 🐋 Whale Master Engine

Balinaların borsadaki izini hacim analizi ile tespit eder.

- **Balina Hacim:** Hacim > Ortalama × Katsayı (varsayılan 2.5x)
- **3 Şart Kuralı:** İşlem açılması için Balina teyidi, Teknik seviye ve Tuzak olmaması gerekir.

### 3.4 🧠 AI Güven Skoru (0-100)

Tüm koşulları **10 bileşenli** ağırlıklı bir skora dönüştürür.

- **65+ puan:** İşlem izni var ✅
- **40-64 puan:** Dikkatli ol ⚠️
- **0-39 puan:** İşlem yasak ❌

### 3.5 🌍 Market Regime Engine

Piyasanın makro durumunu belirler (Risk-ON / Risk-OFF / NEUTRAL).

### 3.6 📡 Regime Prediction (V3)

Piyasa rejimini **momentum ivmesi** kullanarak tahmin eder (Hızlanan trend, Yavaşlayan trend vb.).

### 3.7 💰 Capital & Attention Engine

Sermayeni nereye yönlendireceğini belirler (Primary Flow, Secondary Flow vb.).

### 3.8 ⏱ Time-Decay Alpha

Sinyalin oluşmasından itibaren geçen süreyi izler. 5 bar sonrası sinyal çürümüş kabul edilir.

### 3.9 🛡️ Koruma Mekanizmaları

- **Kill Switch:** Ardışık kayıp sayısına göre sistemi durdurur.
- **System Fatigue:** Overtrading koruması.
- **Self-Pruning:** Modül bazlı başarı takibi.

---

## 4. Input Ayarları

İndikatör ayarlarından Scalp/Swing modlarını, Balina katsayısını (varsayılan 2.5) ve Min AI Skoru (varsayılan 65) gibi parametreleri değiştirebilirsiniz.

---

## 5. Dashboard Paneli

Dashboard sağ üstte 5 ana bölümden oluşur:

- **Teknik Analiz:** Mod, Yapı, F4 Eğilimi vb.
- **Piyasa Verileri:** BTC/ETH/USDT Dominansı.
- **Karar Merkezi:** Balina durumu, AI Skoru, Gelecek Tahmin.
- **Mühendislik Analizi:** MTF Uzlaşısı, İvme, Volatilite, Z-Skor, Kazanma Oranı.
- **Final Karar:** SİSTEM KARARI (İŞLEM AÇ / BEKLE).

---

## 6. Sinyal Sistemi & Alarmlar

Indikatör üzerinde AL/SAT etiketleri ve Balina onaylı girişler (balina ikonları) görülür. 19 teknik ve 11 balina motoru alarmı mevcuttur.

---

# SmartTrade Implementation - 3Commas Compatibility

Bu bölüm, 3Commas takip (trailing) mekanizmalarıyla tam uyumlu SmartTrade modülü detaylarını içerir.

## 1. Emir Tipleri

- **Limit Order:** Emir defterinde belirli fiyata yerleştirilir.
- **Market Order:** Anında en iyi fiyattan gerçekleştirilir.
- **Conditional Order:** Tetiklendiğinde devreye girer.

## 2. Trailing Buy (Takipli Alış)

Düşüş trendinde en düşük fiyattan alım yapmayı hedefler. Fiyat tetik seviyesine düştüğünde aktif olur ve yukarı yönlü belirlenen sapma (%) oluştuğunda alım yapar.

## 3. Trailing Take Profit (TTP)

Kar hedefine ulaşıldığında hemen satmaz, en yüksek fiyatı takip eder ve sapma oluştuğunda kârı realize eder.

## 4. Trailing Stop Loss (TSL)

Average Entry Price (AEP) üzerinden sabit mesafeli stop takibi yapar. Sadece yukarı hareket eder.

## 5. Move to Breakeven

İlk kâr hedefi gerçekleştiğinde Stop Loss seviyesini giriş fiyatına çeker.

## 6. Stop Loss Timeout (Wick Protection)

Anlık sert iğnelerin (wick) stop etmesini engellemek için geri kazanım süresi sağlar.

---

# 🎉 MEXC ULTIMATE TRADING BOT - IMPLEMENTATION COMPLETE

## 📊 Özet Rapor

**Durum:** ✅ **ÜRETİME HAZIR**

### Tamamlanan Altyapı

- **Veritabanı:** PostgreSQL (system_settings, f4_signals, asset_price_history vb. tablolar).
- **Test Modu:** 100k sanal bakiye ile güvenli test ortamı.
- **F4 Algoritması:** Backend ve Frontend entegrasyonu tamamlandı.
- **Cron Jobs:** Portföy anlık görüntüleri ve fiyat geçmişi takibi.

---

# 📘 MEXC Ultimate Trading Bot - User Guide

## 🚀 Başlangıç

1. **API Ayarları:** Ayarlar kısmından MexC anahtarlarınızı bağlayın.
2. **Trading Modu:** Başlangıçta sistem TEST MODU'nda başlar, stratejinizi burada deneyin.
3. **Panic Button:** Sağ üstteki acil durum butonu ile tüm varlıkları anında USDT'ye çevirebilirsiniz.

## 📊 Performans Takibi

Sistem 4 saatte bir portföy snapshotı alır ve Dashboard'daki grafiklerde 24h/7d performansınızı gösterir.

---

> **ÖNEMLİ:** Tüm bu dökümanlar Matrix F4 Ultimate sisteminin tam kapasitesiyle çalışması için gerekli bilgileri içerir. Lütfen işlem yapmadan önce tüm bölümleri okuduğunuzdan emin olun.

_Son Güncelleme: 18 Şubat 2026_
