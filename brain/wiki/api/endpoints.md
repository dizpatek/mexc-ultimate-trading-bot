---
title: API Endpoints
tags: [api, routes, endpoints]
sourceDir: src/app/api/
lastUpdated: 2026-04-09
type: api
---

# 🔌 API Endpoints

Tüm `/api/` rotaları ve işlevleri.

---

## Cron Jobs (Arka Plan)

| Route | Interval | İşlev |
|---|---|---|
| `/api/cron/strategies` | ~30s | SignalScanner + PilotExecutor çalıştır |
| `/api/cron/trailing-stop` | 1s | SmartTradeMonitor döngüsü |
| `/api/cron/alarms` | 30s | Alarm kontrolleri |
| `/api/cron/janitor` | 1h | Eski kayıt temizliği |
| `/api/cron/portfolio-snapshot` | 1h | Portfolio snapshot |
| `/api/cron/price-history` | 1h | Fiyat geçmişi |
| `/api/cron/dca` | 15m | DCA hesaplamaları |

---

## Trade İşlemleri

| Route | Method | İşlev |
|---|---|---|
| `/api/trade` | POST | Manuel SmartTrade açma |
| `/api/panic` | POST | Tüm açık işlemleri kapat |
| `/api/signals` | GET | Sinyal listesi |

---

## Market Verisi

| Route | Method | İşlev |
|---|---|---|
| `/api/klines` | GET | Mum verisi |
| `/api/market` | GET | Piyasa özeti |
| `/api/orderbook` | GET | Emir defteri |
| `/api/indicators` | GET | Teknik göstergeler |
| `/api/portfolio` | GET | Portföy özeti |

---

## Sistem

| Route | Method | İşlev |
|---|---|---|
| `/api/health` | GET | Sistem sağlık kontrolü |
| `/api/auth` | POST | JWT giriş |
| `/api/settings` | GET/POST | Bot ayarları |
| `/api/admin` | GET | Admin panel verisi |
| `/api/logs` | GET | Sistem logları |
| `/api/analytics` | GET | Analitik verisi |

---

## Bağlantılar

- **Cron Detayı:** [[api/cron-jobs|Cron Jobs]]
