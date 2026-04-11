---
title: CombatLog Component
tags: [component, ui, monitoring, react]
sourceFile: src/components/CombatLog.tsx
size: "28KB / 681 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🖥️ CombatLog UI Component

**Dosya:** `src/components/CombatLog.tsx`
**Beslenir:** [[entities/CombatLogsHook|CombatLogsHook]]

---

## Tanım

Dashboard'un sağ panelinde yer alan, sistemin tüm sinir uçlarını gerçek zamanlı olarak izleyen "Merkezi Sinyal Akışı" bileşenidir. Sadece bir 'log' değil, sinyallerin neden veto edildiğini veya onaylandığını gösteren karasal bir komuta merkezidir.

---

## Teknik Özellikler

- **Veto Gösterimi**: Strateji tarafından reddedilen sinyallerin detaylı nedenleri (Pill formatında).
- **Teknik Özet**: RSI, MFI, Trend gibi ham verilerin kutu içinde listelenmesi.
- **Sentiment Renklendirme**: İşlem yönüne göre dinamik border ve text renkleri.
- **Duyarlı Scroll**: Futuristik ve akıcı özelleştirilmiş kaydırma çubuğu.

---

## Bağlantılar

- **Veri Kaynağı:** [[entities/CombatLogsHook|CombatLogsHook]]
- **Görsel Tasarım:** [[entities/Header|Header]] | [[entities/PilotPipeline3D|PilotPipeline3D]]
- **Konsept:** [[concepts/SignalNormalization|Sinyal Normalizasyonu]]
