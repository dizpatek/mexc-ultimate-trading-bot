---
title: PanicService
tags: [entity, panic, emergency, exit]
sourceFile: src/lib/panic-service.ts
size: "5KB / 161 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🚨 PanicService

**Dosya:** `src/lib/panic-service.ts`
**Tetiklenir:** `/api/panic` (UI'dan Panic Exit butonu)

Tüm açık pozisyonları anında kapatır.

---

## İşleyiş

```
1. Tüm FILLED/PENDING orders'ı çek
2. batchFetchPrices() → anlık fiyatlar
3. executeExit() x N → paralel kapama
4. Sonuçları raporla
```

---

## Bağlantılar

- **Akış:** [[flows/05-exit-flow|Exit Akışı]]
