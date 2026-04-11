---
title: WhaleRadarHook
tags: [hook, whale, scanner, alerts]
sourceFile: src/hooks/useWhaleRadar.ts
size: "6KB / 236 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🐋 WhaleRadarHook

**Dosya:** `src/hooks/useWhaleRadar.ts`
**Kullanım:** Radar bileşeninde büyük emirlerin (Whale Alerts) görselleştirilmesi için kullanılır.

---

## Ana Görev

MEXC borsasından gelen veya scanner tarafından tespit edilen büyük miktarlı işlemleri ("Balina Hareketleri") takip eder. Bu verileri sembol bazlı filtreler ve Dashboard üzerinde gerçek zamanlı olarak sunar.

---

## Veri Yapısı

```typescript
interface WhaleAlert {
  symbol: string;
  side: "BUY" | "SELL";
  amount: number;       // USDT Değeri
  price: number;
  timestamp: number;
  isHighImpact: boolean; // % bazlı güç değişimi etkisiyse
}
```

---

## Temel Fonksiyonlar

- **`filterBySymbol()`**: Sadece Dashboard'daki aktif semboller için balina alarmı gösterir.
- **`powerCalculations`**: Büyük işlemlerin fiyatta yarattığı anlık baskıyı (F4 Power Loss) hesaplar.
- **`alertHistory`**: Son 1 saat içindeki yüksek hacimli emirlerin geçmişini tutar.

---

## Bağlantılar

- **Bileşen:** [[entities/WhaleRadar|Whale Radar UI]]
- **Servis:** [[entities/SignalScanner|SignalScanner]]
- **Konsept:** [[concepts/MarketPressure|Market Baskısı]]
