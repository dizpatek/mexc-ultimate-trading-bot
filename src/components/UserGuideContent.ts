export const USER_GUIDE_CONTENT = `# 🧠 Matrix F4 Ultimate V4 – Kullanıcı Kılavuzu

> **Versiyon:** 4.0 Alpha – Web-UI Integration + Ultra-Slim Layout + Trailing Execution  
> **Platform:** Next.js Trading Engine (MexC Connectivity)  
> **Yerleşim:** 3-Sütunlu Profesyonel Terminal

---

## 📋 İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Yeni Arayüz Mimarisi (V4)](#2-yeni-arayüz-mimarisi-v4)
3. [Sol Navigasyon (Mission Control)](#3-sol-navigasyon)
4. [Sağ Kontrol Paneli (Unified Control)](#4-sağ-kontrol-paneli)
5. [Akıllı Emir Sistemi (Trailing Execution)](#5-akıllı-emir-sistemi)
6. [Matrix Engine & AI Skoru](#6-matrix-engine--ai-skoru)
7. [Admin Ayarları & Modül Yönetimi](#7-admin-ayarları)
8. [Strateji Rutini](#8-strateji-rutini)
9. [SSS & Sorun Giderme](#9-sss--sorun-giderme)

---

## 1. Genel Bakış

Matrix F4 Ultimate V4, TradingView tabanlı sinyal motorunu tam entegre bir web ticaret terminaline dönüştürür. Artık sadece sinyal izlemekle kalmaz, **Trailing Buy**, **Trailing Sell** ve **AI Tabanlı Duyarlılık** analizi ile işlemlerinizi tek bir ekrandan yönetebilirsiniz.

---

## 2. Yeni Arayüz Mimarisi (V4)

Terminal, maksimum verimlilik için 3 ana dikey sütuna ayrılmıştır:

- **SOL (Navigasyon):** Ultra-slim (w-16) ikon barı. Sayfalar arası geçişi sağlar.
- **ORTA (Operasyon):** Ana grafikler (TradingView/Lightweight), Mission Control (Matrix Horizon) ve Taktiksel Operasyon Merkezi.
- **SAĞ (Kontrol):** Trading paneli, portföy özeti, AI skoru ve canlı piyasa verileri.

---

## 3. Sol Navigasyon (Mission Control) 🛸

Maksimum ekran alanı için tasarlanmış dikey bar:
- **Dashboard:** Ana terminal görünümü.
- **Settings:** API anahtarları, sistem parametreleri ve modül sağlığı.
- **Profil/Mod:** Mevcut trading modunu (TEST/PROD) hızlı kontrol imkanı.

---

## 4. Sağ Kontrol Paneli (Unified Control) 🔋

Bu panel, işlemin mutfağıdır. Dikey olarak şu bölümlerden oluşur:
- **Ticker Tape:** Anlık izleme listesi (Matrix sinyalleri ile).
- **Portfolio Summary:** Mevcut varlık dağılımı ve kar/zarar durumu.
- **Sentiment & AI Score:** İşlem güvenilirliğini ölçen 0-100 arası AI skoru.
- **Execution Panel:** Alım/Satım formları.

---

## 5. Akıllı Emir Sistemi (Trailing Execution) ⚡

V4 ile gelen en güçlü özellik **Trailing** mekanizmasıdır:

### Trailing Buy (Düştükçe Al)
- Fiyat düşmeye devam ederken alım emrini aşağı çeker.
- Belirlediğiniz **Trailing %** kadar yukarı tepki geldiğinde alımı gerçekleştirir.
- _Sonuç:_ En dipten alım şansınızı artırır.

### Trailing Sell (Yükseldikçe Sat/Takip Et)
- Fiyat yükseldikçe Satış/Kar Al seviyesini yukarı taşır.
- Trend dönüp belirlediğiniz **Trailing %** kadar geri çekildiğinde satışı yapar.
- _Sonuç:_ Trendin sonuna kadar kârda kalmanızı sağlar.

---

## 6. Matrix Engine & AI Skoru 🧠

Sinyal kalitesi 10 farklı metrikle ölçülür:
- **65+ Puan:** "İŞLEM AÇ" onayı ✅
- **40-64 Puan:** "DİKKATLİ OL" uyarısı ⚠️
- **0-39 Puan:** "BEKLE / YASAK" uyarısı ❌

---

## 7. Admin Ayarları & Modül Yönetimi 🔧

Settings sayfasından şu parametreler anlık değiştirilebilir:
- **F4 Length:** Trend hassasiyeti.
- **Whale Multiplier:** Balina hacim eşiği.
- **Defense Mode:** Yüksek volatilitede koruma kalkanı.
- **Simulator Reset:** Test bakiyesini sıfırlama ($100,000 USDT).

---

## 8. Strateji Rutini 📈

1. **Rejim Kontrolü:** Sağ panelden Piyasa Rejimine bakın (Long/Short Uygun mu?).
2. **AI Skor:** Karar vermeden önce AI skorunun 65+ olduğundan emin olun.
3. **Emir Girişi:** Trailing özelliğini aktif ederek giriş yapın.
4. **İzleme:** Mission Control panelinden açık işlemlerin "Fatigue" ve "Win Rate" durumunu izleyin.

---

## 9. SSS & Sorun Giderme ❓

**S: Neden "İŞLEM YASAK" diyor?**  
C: BTC akışı zayıf olabilir veya volatilite çok yüksektir. Sistem sizi koruyor.

**S: Trailing % ne olmalı?**  
C: Scalp için %0.5 - %1.0, Swing için %2.0 - %5.0 önerilir.

**S: Test Modu ile Gerçek Mod farkı nedir?**  
C: Test modu sanal bakiyedir ($100k). Üretim modu (Production) gerçek MEXC API anahtarlarınızı kullanır.

---

_Matrix F4 Ultimate V4 – Powered by Matrix Intelligence_  
_Son Güncelleme: 2026-02-18_
`;
