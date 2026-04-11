---
title: MexCBrain — Ana Katalog
tags: [index, meta]
lastUpdated: 2026-04-11
type: index
---

# 🧠 MexCBrain Bilgi Vikisi

> Bu wiki, `MexCBrain` projesinin tüm sinyal akışını, bileşen bağımlılıklarını ve kavramsal mantığını canlı olarak belgeler.
> **LLM bu dosyaları yazar ve günceller. Sen okuyorsun, LLM programlıyor.**

---

## 🌊 Akış Sayfaları (Sinyal → Finale)

| Sayfa | Açıklama |
|---|---|
| <a href="flows/01-signal-flow.md" class="internal-link">01 — Sinyal Akışı</a> | MEXC veriden MatrixV5 sinyaline |
| <a href="flows/02-pilot-flow.md" class="internal-link">02 — Pilot Akışı</a> | Sinyal kararından SmartTrade açılışına |
| <a href="flows/03-execution-flow.md" class="internal-link">03 — Execution Akışı</a> | SmartTrade entry ve DB kaydı |
| <a href="flows/04-monitor-flow.md" class="internal-link">04 — Monitor Akışı</a> | 1sn döngü: TSL, TTP, Partial TP |
| <a href="flows/05-exit-flow.md" class="internal-link">05 — Exit Akışı</a> | Çıkış sekansları ve sonrası |

---

## 🔷 Entity Sayfaları (Modüller)

| Sayfa | Kaynak Dosya | Açıklama |
|---|---|---|
| <a href="entities/ApiCoreService.md" class="internal-link">ApiCoreService</a> | `src/services/ApiCore.ts` | Merkezi API ve hata yönetimi |
| <a href="entities/CombatLog.md" class="internal-link">CombatLog</a> | `src/components/CombatLog.tsx` | Merkezi sinyal akışı arayüzü |
| <a href="entities/CombatLogsHook.md" class="internal-link">CombatLogsHook</a> | `src/hooks/useCombatLogs.ts` | Sinyal ve sistem log parse |
| <a href="entities/Header.md" class="internal-link">Header</a> | `src/components/Header.tsx` | Üst navigasyon ve profil |
| <a href="entities/PilotPipeline3D.md" class="internal-link">PilotPipeline3D</a> | `src/components/PilotPipeline3D.tsx` | 3D işlem akış görselleştirme |
| <a href="entities/SmartTradeLogicHook.md" class="internal-link">SmartTradeLogicHook</a> | `src/hooks/useSmartTradeLogic.ts` | İşlem oluşturma ve borsa mantığı |
| <a href="entities/TradePanel.md" class="internal-link">TradePanel</a> | `src/components/ActiveSmartTrades.tsx` | Manuel işlem paneli |
| <a href="entities/WhaleRadarHook.md" class="internal-link">WhaleRadarHook</a> | `src/hooks/useWhaleRadar.ts` | Balina hareket takip ve alarm |
| <a href="entities/api.md" class="internal-link">api</a> | `src/services/api.ts` | Axios instance ve interceptor |
| <a href="entities/PanicService.md" class="internal-link">PanicService</a> | `src/lib/panic-service.ts` | Acil çıkış servisi |

---

## 💡 Kavram Sayfaları (Mantık Açıklamaları)

| Sayfa | Açıklama |
|---|---|
| <a href="concepts/TSL-TTP-Logic.md" class="internal-link">TSL / TTP Mantığı</a> | Trailing Stop Loss ve Trailing Take Profit |
| <a href="concepts/CDT-ReEntry.md" class="internal-link">CDT Re-Entry Sistemi</a> | Cover-to-Trade geri alım mekanizması |
| <a href="concepts/Matrix-Flip.md" class="internal-link">Matrix Flip</a> | COVER → TRADE otomatik yön değiştirme |
| <a href="concepts/PilotModes.md" class="internal-link">Pilot Modları</a> | Matrix vs Hedge mod farkları |
| <a href="concepts/AiScore.md" class="internal-link">Ai Score Hesaplama</a> | GIGA MASTER AI Score bileşenleri |
| <a href="concepts/MTF-Consensus.md" class="internal-link">MTF Consensus</a> | Multi-Timeframe oylama ve veto sistemi |
| <a href="concepts/Confluence.md" class="internal-link">Confluence Engine</a> | 6 kategorili confluence hesaplama |
| <a href="concepts/ReEntrySystem.md" class="internal-link">Re-Entry Sistemi</a> | Pilot_auto satış → tekrar alım |
| <a href="concepts/SignalNormalization.md" class="internal-link">Sinyal Normalizasyonu</a> | Homojen veri formatlama süreci |
| <a href="concepts/MarketPressure.md" class="internal-link">Market Baskısı</a> | Balina ve hacim etkisi |
| <a href="concepts/SignalNormalization.md" class="internal-link">Sinyal Normalizasyonu</a> | Homojen veri formatlama süreci |
| <a href="concepts/MarketPressure.md" class="internal-link">Market Baskısı</a> | Balina ve hacim etkisi |
| <a href="concepts/LogTypes.md" class="internal-link">Log Türleri</a> | Sistem ve sinyal mesaj kategorileri |
| <a href="concepts/Reliability.md" class="internal-link">Sistem Güvenilirliği</a> | Timeout ve hata yönetimi prensipleri |
| <a href="concepts/OrderManagement.md" class="internal-link">Emir Yönetimi</a> | İşlem açma ve bakiye kontrolü |

---

## 🔌 API & Cron Sayfaları

| Sayfa | Açıklama |
|---|---|
| <a href="api/endpoints.md" class="internal-link">API Endpoints</a> | Tüm `/api/` route'ları |
| <a href="api/cron-jobs.md" class="internal-link">Cron Jobs</a> | Zamanlanmış arka plan görevleri |

---

## 📊 İstatistikler

```dataview
TABLE tags, lastUpdated
FROM ""
WHERE type != "index"
SORT lastUpdated DESC
LIMIT 20
```

---

*Son güncelleme: 2026-04-09 | Otomatik wiki-gen.ts tarafından yönetilir*
