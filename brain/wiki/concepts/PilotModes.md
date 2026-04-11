---
title: "Pilot Modları"
tags: [concept, pilot, matrix, hedge, mode]
related:
  - entities/PilotExecutor
  - flows/02-pilot-flow
lastUpdated: 2026-04-09
type: concept
---

# ✈️ Pilot Modları — Matrix vs Hedge

`botConfig.pilot_mode` ile ayarlanır.

---

## Matrix Modu (Varsayılan)

```
Kural: Sembol bazlı limitler

Her sembol için:
  Max 1 LONG (TRADE) pozisyon
  Max 1 SHORT (COVER) pozisyon

"BTCUSDT için hem long hem short aynı anda açılabilir"
```

### Matrix Flip

BTCUSDT'de COVER varken BUY sinyali gelirse:
→ COVER kapatılır, TRADE açılır

---

## Hedge Modu

```
Kural: Global limitler (tüm semboller)

Tüm portföyde:
  Max 1 LONG (TRADE) pozisyon (hangi sembol olursa)
  Max 1 SHORT (COVER) pozisyon (hangi sembol olursa)

"BTCUSDT'de long varken ETHUSDT'de yeni long açılmaz"
```

### Neden Hedge?

- Daha konservatif strateji
- Tek yönde over-exposure engellenir
- Küçük portföyler için ideal

---

## Karşılaştırma

| Özellik | Matrix | Hedge |
|---|---|---|
| Aynı anda max LONG | Sınırsız sembol | 1 sembol |
| Aynı anda max SHORT | Sınırsız sembol | 1 sembol |
| Matrix Flip | ✅ Aktif | ❌ Yok |
| Risk seviyesi | Orta | Düşük |

---

## Bağlantılar

- **Modül:** [[entities/PilotExecutor|PilotExecutor]]
- **Akış:** [[flows/02-pilot-flow|Pilot Akışı]]
- **İlgili:** [[concepts/Matrix-Flip|Matrix Flip]]
