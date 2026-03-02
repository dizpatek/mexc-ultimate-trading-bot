# Telegram Signal Listener - Kurulum ve Kullanım

## Gereksinimler

```bash
pip install telethon aiohttp
```

## Konfigürasyon

`.env` dosyanıza ekleyin:

```env
# Telegram API Credentials (https://my.telegram.org/apps adresinden alın)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=+905551234567

# Next.js API URL (production için)
NEXTJS_API_URL=https://your-app.vercel.app/api/signals/telegram
```

## Kullanım

### Development (Local)

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Telegram listener
python telegram_listener.py
```

### Production

Telegram listener'ı ayrı bir sunucuda çalıştırın (VPS, Railway, Heroku, vb.)

```bash
# Arka planda çalıştır
nohup python telegram_listener.py > telegram.log 2>&1 &

# Veya systemd service olarak
sudo systemctl start telegram-signals
```

## Nasıl Çalışır?

1. **Telegram Listener** (@signalscryptoglobal kanalını dinler)
2. Yeni mesaj geldiğinde **parse eder**
3. Valid signal ise **Next.js API'ye POST** eder
4. Next.js API signali **in-memory** saklar
5. Frontend `/api/signals/telegram` endpoint'inden **signalleri çeker**

## API Endpoints

### GET /api/signals/telegram
Tüm signalleri getirir

```typescript
{
  success: true,
  count: 10,
  signals: [...]
}
```

### POST /api/signals/telegram
Yeni signal ekler (Telegram listener kullanır)

```typescript
{
  symbol: "BTCUSDT",
  entry: 45000,
  targets: [46000, 47000],
  stop_loss: 44000,
  direction: "LONG",
  pair_type: "SPOT",
  exchange: "MEXC"
}
```

### DELETE /api/signals/telegram
Tüm signalleri temizler

## Monitoring

```bash
# Telegram listener loglarını izle
tail -f telegram.log

# Signal loglarını izle
tail -f signals_log.json
```

## Production Deployment

### Option 1: Railway (Önerilen)
1. Railway.app'e giriş yapın
2. New Project > Deploy from GitHub
3. Environment variables ekleyin
4. Deploy!

### Option 2: VPS
1. Ubuntu/Debian sunucu kiralayın
2. Python 3.9+ kurun
3. Systemd service oluşturun
4. Başlatın

### Option 3: Heroku
```bash
heroku create your-telegram-listener
heroku config:set TELEGRAM_API_ID=xxx
heroku config:set TELEGRAM_API_HASH=xxx
heroku config:set TELEGRAM_PHONE=xxx
heroku config:set NEXTJS_API_URL=https://your-app.vercel.app/api/signals/telegram
git push heroku main
```

## Troubleshooting

### "Could not find the input entity"
- Önce Telegram'dan @signalscryptoglobal kanalına katılın

### "SessionPasswordNeededError"
- 2FA şifrenizi girin

### "API connection failed"
- NEXTJS_API_URL doğru mu kontrol edin
- Next.js app çalışıyor mu kontrol edin

## Güvenlik

- `.env` dosyasını **asla** commit etmeyin
- `signals_session.session` dosyasını **güvende** tutun
- Production'da **HTTPS** kullanın
