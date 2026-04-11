---
title: AlarmEngine
tags: [entity, alarm, notification, price]
sourceFile: src/lib/alarm-engine.ts
size: "8KB / 240 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🔔 AlarmEngine

**Dosya:** `src/lib/alarm-engine.ts`
**Tetiklenir:** `/api/cron/alarms`

Kullanıcı tanımlı fiyat alarmlarını kontrol eder ve Telegram bildirimi gönderir.

---

## Alarm Türleri

- Fiyat eşik geçişi (üstü / altı)
- RSI breakout
- Volume surge
- Pattern tamamlama

---

## Bağlantılar

- **API:** [[api/cron-jobs|Cron Jobs]]
