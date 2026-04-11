---
title: ApiCoreService
tags: [service, api, axios, core]
sourceFile: src/services/ApiCore.ts
size: "11KB / 345 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🌐 ApiCoreService

**Dosya:** `src/services/ApiCore.ts`
**Dahili Kullanım:** `services/api.ts` ve tüm frontend hook'ları tarafından temel katman olarak kullanılır.

---

## Ana Görev

Tüm HTTP isteklerini (GET, POST, DELETE) standarize eden merkezi servistir. Hata yönetimi (Error Handling), Kimlik Doğrulama (Auth Headers) ve İstek Zaman Aşımı (Timeout) ayarları burada yapılandırılır.

---

## Public static Methods

- **`ApiCore.get<T>(url, config)`**: Tip güvenli GET isteği.
- **`ApiCore.post<T>(url, data, config)`**: Tip güvenli POST isteği.
- **`ApiCore.request<T>(config)`**: Axios bazlı genel istek yönetici.

---

## Özellikler

- **Zaman Aşımı**: Varsayılan 10s (Uygulama genelinde performans için optimize edilmiştir).
- **Hata Yakalama**: 401 (Unauthorized) durumunda otomatik logout veya bildirim tetikleme.
- **BaseURL**: `process.env.NEXT_PUBLIC_API_URL` üzerinden dinamik endpoint yönetimi.

---

## Bağlantılar

- **Servis:** [[entities/api|API Utility]]
- **Auth:** [[entities/AuthService|AuthService]]
- **Konsept:** [[concepts/Reliability|Sistem Güvenilirliği]]
