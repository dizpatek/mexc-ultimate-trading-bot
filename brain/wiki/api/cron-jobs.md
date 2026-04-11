---
title: Cron Jobs
tags: [api, cron, background, automation]
lastUpdated: 2026-04-09
type: api
---

# ⏱️ Cron Jobs — Zamanlanmış Arka Plan Görevleri

---

## /api/cron/trailing-stop — Ana Monitor

```
Frekans: Her 1 saniye
Bot Worker: scripts/bot-worker.mjs tarafından çağrılır

İşlev:
  monitorSmartTrades("test")
  monitorSmartTrades("production")
  
Throttle: MONITOR_INTERVAL = 1000ms
```

**Akış:** [[flows/04-monitor-flow|Monitor Akışı]]

---

## /api/cron/strategies — Sinyal + Pilot Motoru

```
Frekans: ~30 saniye (Northflank scheduler)

İşlev:
  1. SignalScanner.resolveScanSymbols()
  2. SignalScanner.runScan()
  3. PilotExecutor.handleSignal() (her aktif sinyal için)
  
Concurrency: 8 sembol paralel
```

**Akış:** [[flows/01-signal-flow|Sinyal Akışı]] → [[flows/02-pilot-flow|Pilot Akışı]]

---

## /api/cron/alarms

```
Frekans: 30s
İşlev: AlarmEngine — fiyat alarmlarını kontrol et
       Telegram bildirimi gönder (eşik geçilince)
```

**Modül:** [[entities/AlarmEngine|AlarmEngine]]

---

## /api/cron/janitor

```
Frekans: Her 1 saat
İşlev: Eski/tamamlanan kayıtları temizle
       DB bloat'ı önle
```

---

## Bot Worker (scripts/bot-worker.mjs)

```javascript
// npm run dev içinde concurrently ile başlar
// Northflank'ta ayrı bir container olarak çalışır

Görevler:
  - trailing-stop endpoint'ini 1s'de bir çağır
  - strategies endpoint'ini 30s'de bir çağır
  - Hata yönetimi + otomatik yeniden başlatma
```

---

## Bağlantılar

- **API:** [[api/endpoints|API Endpoints]]
