# Matrix Pro Bridge v3.0

TradingView web modunda Google ile giriş yapabilmek için Chrome eklentisi.

## Kurulum

1. Chrome'u açın ve `chrome://extensions` adresine gidin
2. Sağ üst köşeden **"Developer mode"** (Geliştirici modu) etkinleştirin
3. **"Load unpacked"** (Paketlenmemiş öğe yükle) butonuna tıklayın
4. Bu klasörü (`.antigravity-extension`) seçin
5. Eklenti yüklenecek ve araç çubuğunda görünecektir

## Özellikler

### 1. X-Frame-Options Bypass

TradingView'ın iframe içinde çalışmasını sağlar. Bu sayede web modunda TradingView grafiklerini uygulama içinde görebilirsiniz.

### 2. Google Hesap Yönetimi

- Google hesaplarınızı otomatik algılar
- Hesap seçimi ile kolay giriş
- Cookie yönetimi

### 3. Cookie Yönetimi

- TradingView cookies görüntüleme
- Cookie temizleme
- Oturum durumu kontrolü

## Kullanım

### Web Moduna Giriş

1. Uygulamada **"Web Modu"** butonuna tıklayın
2. Eğer giriş yapmadıysanız, giriş penceresi açılacak
3. Google hesabınızı seçin ve giriş yapın
4. Giriş tamamlandıktan sonra web modu aktif olacak

### Eklenti Popup'ı

Eklenti ikonuna tıklayarak:

- TradingView giriş durumunu görebilirsiniz
- Google hesaplarınızı yönetebilirsiniz
- Cookieleri temizleyebilirsiniz
- Durumu yenileyebilirsiniz

## Dosya Yapısı

```
.antigravity-extension/
├── manifest.json      # Eklenti tanımı ve izinler
├── background.js      # Service worker (cookie yönetimi)
├── content.js         # TradingView sayfasında çalışan script
├── popup.html         # Eklenti popup arayüzü
├── popup.js           # Popup işlevleri
├── rules.json         # Header değiştirme kuralları
└── README.md          # Bu dosya
```

## Teknik Detaylar

### Manifest v3

Eklenti Chrome'un Manifest v3 standardını kullanır.

### Declarative Net Request

X-Frame-Options ve Content-Security-Policy header'larını kaldırmak için declarative_net_request API kullanılır.

### Cookie API

TradingView ve Google cookies okuma/yazma için cookies API kullanılır.

## Sorun Giderme

### Beyaz Ekran

- Eklentinin yüklü ve etkin olduğundan emin olun
- Sayfayı yenileyin
- ignore-x-frame-options eklentisi de kullanabilirsiniz

### Giriş Çalışmıyor

- Popup engelleyiciyi devre dışı bırakın
- Chrome ayarlarından üçüncü taraf cookielere izin verin
- Eklenti popup'ından "Cookieleri Temizle" yapıp tekrar deneyin

### Cookie Hatası

- Chrome'da `chrome://settings/cookies` adresine gidin
- Üçüncü taraf cookielere izin verin
- "Block third-party cookies" seçeneğini kapatın

## Güvenlik Notu

Bu eklenti sadece:

- TradingView.com
- Google.com
- accounts.google.com

alanlarında çalışır. Başka sitelerde herhangi bir işlem yapmaz.

## Güncellemeler

### v3.0

- Tamamen yenilenen arayüz
- Google hesap seçici
- Cookie yönetim paneli
- Daha iyi hata mesajları

### v2.5

- Iframe bypass iyileştirmeleri
- Redirect koruması

### v2.0

- Manifest v3 geçişi
- Declarative net request

---

**Not:** Bu eklenti kişisel kullanım içindir. TradingView'ın kullanım şartlarına uygun şekilde kullanınız.
