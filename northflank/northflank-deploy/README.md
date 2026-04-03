# Northflank Deploy Tools

Bu araç, Northflank projelerini yönetmek ve servislerin ortam değişkenlerini güncellemek için hazırlanmış bağımsız bir Node.js yardımcı programıdır.

## Kurulum

1. Klasöre gidin:

```bash
cd scripts/northflank-deploy
```

2. Bağımlılıkları yükleyin:

```bash
npm install
```

3. `.env` dosyasını kontrol edin. `NF_API_TOKEN` değişkeninin doğru olduğunu doğrulayın.

## Kullanım

### Projeleri Listeleme

```bash
node deploy.mjs list-projects
```

### Servisleri Listeleme (Bir proje ID'si gerektirir)

```bash
node deploy.mjs list-services <projectId>
```

### Ortam Değişkenlerini Güncelleme (Groq API Keys)

Aşağıdaki komut Groq API anahtarlarını belirtilen servise yükler ve servisi yeniden başlatır:

```bash
node deploy.mjs update-env <projectId> <serviceId>
```

## Güvenlik

Bu klasördeki `.env` dosyası ana proje `.gitignore` dosyasına eklenmiştir. API anahtarınızın yanlışlıkla GitHub'a gönderilmediğinden emin olun.
