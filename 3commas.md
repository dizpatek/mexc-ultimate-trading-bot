3Commas SmartTrade & Trailing Mekanizmaları — Kapsamlı Bilgi Belgesi
Kaynak: 3Commas Help Center
Tarih: 2026-02-18

1. Emir Tipleri (Order Types)
   Limit Order
   Borsanın emir defterine belirli fiyattan yerleştirilir
   Düşük likidite, geniş spread veya büyük emirlerde tercih edilir
   Fiyat 8 ondalık basamağa kadar desteklenir
   Eğer fiyat zaten piyasadan iyiyse anında gerçekleşir (exchange en iyi fiyatı yakalar)
   Market Order
   Anında en iyi mevcut fiyattan gerçekleşir
   Fiyat takip tipi seçilebilir: ASK, BID, LAST
   Hızlı giriş/çıkış gereken stratejiler için
   Conditional Order (Koşullu Emir)
   Trigger fiyatına ulaşılana kadar emir oluşmaz, sermaye serbest kalır.

Alt Tip Açıklama
Conditional Limit Trigger fiyatına ulaşınca, belirli fiyattan Limit emir yerleştirilir
Conditional Market Trigger fiyatına ulaşınca, Market emir olarak çalışır. Trailing Buy ve Trailing SL için idealdir 2. Trailing Buy (Takipli Alış)
Amaç: Düşen bir varlığı en düşük noktaya yakın fiyattan almak.

Mekanizma
Trailing Buy aktifleştirildiğinde emir tipi otomatik olarak Conditional Market Order olur
Bir trigger fiyatı ve sapma yüzdesi (deviation %) belirlenir
Fiyat trigger fiyatına düştüğünde trailing aktif olur
Fiyat düşmeye devam ettikçe trailing bunu takip eder
Fiyat, en düşük noktadan belirlenen sapma % kadar yukarı döndüğünde alım emri verilir
Örnek
Parametre Değer
Mevcut BTC fiyatı $34,360
Trigger fiyatı $33,500
Deviation 1%
Fiyat $33,500'e düşünce trailing aktif olur
Fiyat $33,000'e kadar düşer → trailing bu dibi takip eder
Fiyat $33,000'den %1 yükselip $33,330'a geldiğinde alım gerçekleşir
ETH Örneği
Trigger: $400, Deviation: %10
Fiyat $350'ye kadar düşer, sonra $385'e yükselir (%10 geri dönüş)
$385'ten alım yapılır → $400 yerine $385'ten giriş = %4 tasarruf
Trailing Sell
Trailing Buy'ın tersi mantıkla çalışır — yükselen bir varlığı en yüksek noktaya yakın fiyattan satmak için.

Avantajlar
Düşüş devam ederken almayı engeller
Otomatik izleme ve koşul karşılandığında çalıştırma
Genellikle trigger fiyatından daha iyi bir fiyat yakalar 3. Take Profit (TP — Kâr Al)
SmartTrade'de TP
Emir tipi seçilebilir: Limit veya Market
Fiyat veya % olarak ayarlanabilir
8'e kadar Split Target (Çoklu TP) desteklenir
Trailing TP tüm borsalarda desteklenir
Çoklu TP (Split Targets) Örneği
Target Miktar Fiyat
TP1 %30 $250
TP2 %30 $260
TP3 %20 $270
TP4 %20 $280
Not: Trailing TP, yalnızca son TP basamağına uygulanır.

Not: Limit Order'da trailing aktifse, son TP Market Order olarak çalışır.

DCA Bot'larda TP
Trailing TP kapalıysa → Limit emir
Trailing TP açıksa → Market emir
Manuel Limit/Market seçimi yoktur (SmartTrade'den farklı)
TradingView webhook ile de tetiklenebilir (her zaman Market) 4. Trailing Take Profit (TTP — Takipli Kâr Al)
Mekanizma
Fiyat TP hedefine ulaşınca TTP aktif olur
Fiyat olumlu yönde devam ettikçe bot takip eder
Fiyat, en yüksek noktadan belirlenen sapma % kadar geri döndüğünde satış emri verilir
Formül
Trailing Stop Satış Fiyatı = En yüksek fiyat × (1 - Trailing Deviation %)
Detaylı Örnek
Parametre Değer
Giriş fiyatı 1000 USDT
TP hedefi +%10 = 1100 USDT
Trailing Deviation %2
Senaryo:

Fiyat 1100 USDT'ye ulaşır → TTP aktifleşir, stop = 1100 × 0.98 = 1078 USDT
Fiyat 1150'ye yükselir → stop = 1150 × 0.98 = 1127 USDT'ye çekilir
Fiyat 1127'ye düşer → satış gerçekleşir
Sonuç: %12.7 kâr (basit TP'de sadece %10 olurdu)
TTP Aktivasyon Doğrulaması
Bot, borsadan canlı fiyat stream'i alır. TP seviyesi aşıldığında borsaya doğrulama isteği gönderir (50ms–birkaç saniye). Sahte sinyal (wick) filtrelenir. Doğrulanırsa trailing aktif olur.

Sapma (Deviation) Ayarlama Kuralları
Kural Açıklama
TP'ye göre oransal ayarla Deviation, TP'nin makul bir kesri olmalı
TP'ye eşit yapma Kâr sıfır olur
TP'nin ¼'ünden fazla yapma Aşırı risk
Düşük likidite/yüksek spread'de kullanma Slippage riski
Önerilen Ayarlar
TP Deviation
+%5 -%1
+%8 -%1.5
+%10 -%2
+%15 -%3
Kaçınılması Gereken Ayarlar
TP Deviation Neden
+%5 -%5 Kâr sıfır olur
+%5 -%4 Çok az kâr kalır
+%10 -%8 Sadece %2 net kâr
+%15 -%20 TP'den büyük, mantıksız 5. Stop Loss (SL)
Temel SL
Fiyat belirli seviyeye düşerse pozisyonu kapatır
Conditional Market veya Conditional Limit olarak çalışabilir
Kayıpları sınırlar, ama kârlı işlemlerde de kullanılabilir
Stop Loss Timeout (Zaman Aşımı)
Sahte düşüşlere (wick/fake-out) karşı koruma:

Fiyat SL seviyesine düşer
Geri sayım başlar (ör. 10 saniye)
Fiyat geri sayım içinde SL üzerine çıkarsa → işlem açık kalır
Fiyat SL altında kalırsa → işlem kapanır
Düzensiz hareket eden veya düşük likiditeye sahip coinlerde yararlıdır.

Trailing Stop Loss (TSL — Takipli Zarar Durdur)
Fiyat yükseldikçe SL otomatik yukarı çekilir.

SmartTrade'de TSL Formülü
Trail Value = AEP (Average Entry Price) × SL%
Yeni SL = En Yüksek Fiyat − Trail Value
Trail mesafesi sabittir (AEP'ye bağlı)
AEP değişirse (ek alım) trail value yeniden hesaplanır
SL asla aşağı inmez, sadece yukarı çıkar
Binance-Tarzı TSL Formülü (DCA Bot'larda)
Stop Price = En Yüksek Fiyat × (1 − Trailing%)
Trail mesafesi fiyat yükseldikçe genişler (SmartTrade'den farklı)
Örnek Karşılaştırma
3Commas SmartTrade Binance-tarzı
Giriş (AEP) $100 $100
SL / Trail % %3 %3
Trail Value $3 (sabit) Değişken
Fiyat $120'ye ulaşırsa SL = $120 − $3 = $117 SL = $120 × 0.97 = $116.40
Move to Breakeven (Başabaş Noktasına Taşı)
İlk TP hedefine ulaşıldığında SL otomatik olarak giriş fiyatına çekilir.

Gereksinim: En az 2 TP hedefi olmalı.

Olay SL
Giriş $100, SL $90 $90
TP1 $110 tetiklenir SL → $100 (breakeven)
TP2 $120 tetiklenir SL = $100 (sabit kalır)
Fiyat $100'e düşer SL tetiklenir, başabaş çıkış 6. Smart Cover (Akıllı Koruma)
SmartTrade'in tersi: Önce sat, sonra daha ucuza geri al.

Kullanım Alanları
Senaryo Açıklama
Spot Smart Cover Sahip olduğun varlığı sat, TP ile daha ucuza geri al
"Use Existing Assets" Zaten sattıysan, sadece geri alış koşulunu kur
Futures Smart Short Short pozisyon aç ve yönet
Futures "Use Existing Assets" Mevcut short pozisyonu 3Commas'a import et
TP/SL ve Trailing
Smart Cover'da da Take Profit, Stop Loss ve Trailing özellikleri kullanılabilir. Aynı mekanizmalar geçerlidir.

7. Trailing Kullanılmaması Gereken Durumlar
   Durum Neden
   Düşük günlük işlem hacmi (< 100 BTC) Yeterli eşleşme olmayabilir
   Düşük likidite Market emir ile slippage riski
   Yüksek spread Alış-satış farkı kârı yiyebilir
   Pump & Dump Ani yükseliş + çöküş, trailing yakalayamaz
   Kesin fiyat hedefi Trailing ile hedefe tam ulaşılamayabilir
   Bu durumlarda Limit emir tercih edilmelidir.

8. Uygulama İçin Temel Çıkarımlar (MexC2026 SmartTrade Modülü İçin)
   Implement Edilecek Trailing Mekanizmaları
   Trailing Buy:

Trigger fiyatı + deviation % parametreleri
Fiyat trigger'a düşünce trailing izleme başlar
En düşük noktadan deviation % yukarı dönünce Market alım
Trailing Take Profit:

TP hedefine ulaşınca trailing aktif olur
En yüksek noktadan deviation % geri dönünce Market satış
Sadece son TP basamağına uygulanır (çoklu TP'de)
Trailing Stop Loss:

SL aktifken fiyat yükseldikçe SL yukarı çekilir
Trail value = AEP × SL% (sabit mesafe, Binance-tarzı değil)
SL asla aşağı inmez
Move to Breakeven:

İlk TP tetiklenince SL → giriş fiyatına taşınır
En az 2 TP basamağı gerekir
Stop Loss Timeout:

SL tetiklenince X saniye bekle
Fiyat geri çıkarsa işlemi açık tut
Wick/fake-out koruması
