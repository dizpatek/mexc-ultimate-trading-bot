# 🛠️ Google OAuth Setup Guide (Matrix Horizon)

Google Login sırasında **`deleted_client`** hatası alıyorsanız, mevcut Client ID'niz silinmiş veya geçersiz kalmış demektir. Sorunu çözmek için aşağıdaki adımları sırasıyla uygulayın.

### Adım 1: Google Cloud Console Giriş

1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin.
2. Üst menüden projenizi seçin (veya yeni bir proje oluşturun).

### Adım 2: API ve Kimlik Bilgileri

1. Sol menüden **APIs & Services > Credentials** (API'ler ve Hizmetler > Kimlik Bilgileri) sekmesine tıklayın.
2. Eğer "OAuth consent screen" (OAuth izin ekranı) daha önce yapılandırılmadıysa, onu "External" olarak kurun ve sadece email/app name girerek kaydedin.

### Adım 3: Yeni Client ID Oluşturma

1. **+ CREATE CREDENTIALS** butonuna tıklayın ve **OAuth client ID** seçeneğini seçin.
2. **Application type:** `Web application` seçin.
3. **Name:** `Matrix Trading Bot` (veya dilediğiniz bir isim).
4. **Authorized JavaScript origins:**
   - `http://localhost:3000` ekleyin.
5. **Authorized redirect URIs:** (Boş bırakabilirsiniz veya `http://localhost:3000` ekleyebilirsiniz).
6. **CREATE** butonuna basın.

### Adım 4: Projeyi Güncelleme

1. Karşınıza çıkan penceredeki **Your Client ID** değerini kopyalayın.
2. Proje dizinindeki `.env.local` dosyasını açın.
3. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` satırını bulun ve kopyaladığınız yeni ID ile değiştirin:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID="YENI_ID_BURAYA"
   ```
4. Terminalde çalışan uygulamayı durdurun (`Ctrl + C`) ve tekrar başlatın:
   ```bash
   npm run dev
   ```

---

⚠️ **Not:** 'deleted_client' hatası aldığınız sürece Google ile giriş yapamazsınız. Yukarıdaki adımlar bu sorunu %100 çözecektir.
