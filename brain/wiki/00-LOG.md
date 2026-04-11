# 📋 MexCBrain Wiki — Değişiklik Günlüğü

> Append-only log. Her ingest, query veya lint işlemi buraya kaydedilir.
> Format: `## [YYYY-MM-DD] tip | başlık`
> Grep ile filtrele: `grep "^## \[" 00-LOG.md | tail -20`

---

## [2026-04-11] build | Wiki yeniden oluşturuldu

- **İşlem:** Tam build
- **Güncellenen:** 3 sayfa
- **Değişmeyen:** 19 sayfa
- **Kapsam:** Tüm entity sayfaları

---

## [2026-04-11] build | Wiki yeniden oluşturuldu

- **İşlem:** Tam build
- **Güncellenen:** 3 sayfa
- **Değişmeyen:** 16 sayfa
- **Kapsam:** Tüm entity sayfaları

---

## [2026-04-11] ingest | Yeni Modüllerin Wiki'ye Dahil Edilmesi

- **İşlem:** Yeni Entity sayfaları (`CombatLogsHook`, `SmartTradeLogicHook`, `WhaleRadarHook`, `ApiCoreService`) oluşturuldu ve haritaya eklendi.
- **Kapsam:** `src/hooks/`, `src/services/ApiCore.ts`
- **Notlar:** Dashboard'un temel veri akışını ve işlem mantığını yöneten bu kritik modüller artık teknik haritada takip edilebilir durumdadır.

---

## [2026-04-11] build | Wiki yeniden oluşturuldu

- **İşlem:** Tam build (Eksik modüller dahil edildi)
- **Güncellenen:** 16 sayfa (4 yeni entegrasyon)
- **Kapsam:** Tüm projenin güncel durumu işlendi.

---

- **İşlem:** Tam build
- **Güncellenen:** 12 sayfa
- **Değişmeyen:** 0 sayfa
- **Kapsam:** Tüm entity sayfaları

---

## [2026-04-09] auto-dev | Otopilot Performans & Wiki Temizliği

- **İşlem:** Otomatik kod güncellemesi.
- **Kapsam:** `SmartTradeMonitor` ve `00-INDEX.md`
- **Kaynak:** `src/lib/smart-trade-monitor.ts`, `brain/wiki/00-INDEX.md`
- **Notlar:** 
  1. Obsidian Graph vizyonundaki "örümcek ağı" problemini çözmek için `00-INDEX.md` içindeki tüm dahili linkler `<a>` HTML etiketlerine dönüştürüldü (böylece haritada merkez bağımsızlaştı).
  2. `SmartTradeMonitor` içinde 1 saniyelik CPU Tüketimini (Throttling) optimize etmek adına, tek bir döngüde birden fazla aynı parite işlemi için Global AI Score Cache yapısı oluşturuldu. Artık Matrix motoru aynı data için gereksiz yere çalışmayacak.

---

## [2026-04-09] auto-dev | AutoResearch Entegrasyonu: SignalScanner.ts

- **İşlem:** Otomatik kod güncellemesi.
- **Kapsam:** Sinyal Motoru ve Wiki Ajanı Başlangıcı.
- **Kaynak:** `src/services/SignalScanner.ts`, `scripts/agent-developer.ts`
- **Notlar:** AutoResearch makine öğrenimi scriptinin ("AutoResearch - Kısayol") bulduğu en iyi parametrelerin (`getBestExperiment`), otopilot sinyal motoruna (MatrixV5) doğrudan enjekte edilmesi sağlandı. Otonom geliştirici template eklendi.

---

## [2026-04-09] build | Wiki yeniden oluşturuldu

- **İşlem:** Tam build
- **Güncellenen:** 3 sayfa
- **Değişmeyen:** 9 sayfa
- **Kapsam:** Tüm entity sayfaları

---

## [2026-04-09] init | Wiki sistemi ilk kurulumu

- **İşlem:** Initial wiki build
- **Kapsam:** Tüm akış sayfaları, entity sayfaları, concept sayfaları oluşturuldu
- **Kaynak:** MexCBrain projesi — `src/` klasörü tam analiz
- **Sayfalar oluşturuldu:**
  - `flows/01-signal-flow.md` — Sinyal akışı (MEXC → MatrixV5 → Signal DB)
  - `flows/02-pilot-flow.md` — Pilot sekansları (5 yol: newBuy, reEntry, CDT, cover, existing)
  - `flows/03-execution-flow.md` — SmartTrade entry + DB
  - `flows/04-monitor-flow.md` — 1s monitor döngüsü (TSL/TTP)
  - `flows/05-exit-flow.md` — Exit sekansları + Re-Entry hook
  - `entities/` — 12 entity sayfası
  - `concepts/` — 8 kavram sayfası
  - `api/` — endpoint ve cron dökümantasyonu
- **Notlar:** Projenin tüm import bağımlılıkları Obsidian wikilink formatına çevrildi

---

## [2026-04-09] auto-dev | Otonom Entegrasyon: AutoResearch Parametrelerini MatrixV5'e Otomatik Enjekte Etmek

- **İşlem:** Otomatik kod güncellemesi.
- **Notlar:** AutoDeveloper scripti tarafından başarıyla tamamlandı.
