---
title: CombatLogsHook
tags: [hook, logs, parsing, combat-log]
sourceFile: src/hooks/useCombatLogs.ts
size: "18KB / 538 satır"
lastUpdated: 2026-04-11
type: entity
---

# 📜 CombatLogsHook

**Dosya:** `src/hooks/useCombatLogs.ts`
**Kullanım:** `CombatLog.tsx` bileşeninde sinyal ve sistem hareketlerini listelemek için kullanılır.

---

## Ana Görev

Bu hook, veritabanından gelen ham sinyal ve sistem loglarını (`strategy_signals` ve `system_logs`) çekip, kullanıcı arayüzünde (Dashboard) anlamlı bir şekilde gösterilecek olan `LogEntry` formatına dönüştürür. Özellikle **Veto** durumlarını ve teknik indikatörleri ayrıştırmaktan sorumludur.

---

## Public API

```typescript
function useCombatLogs(timeframe: string, isWhaleOnly: boolean = false) {
  return {
    logs: LogEntry[],          // Formatlanmış log listesi
    isLoading: boolean,        // Yükleme durumu
    isError: boolean,          // Hata durumu
    refresh: () => void        // Manuel yenileme
  }
}
```

---

## LogEntry Veri Yapısı

Bkz: [[concepts/LogTypes|Log Türleri]]

```typescript
interface LogEntry {
  id: string;
  timestamp: number;
  type: "EXECUTION" | "SYSTEM" | "AI_DECISION" | "WHALE_ALERT" | "STRUCTURE" | "F4_SIGNAL";
  message: string;             // Başlık (örn: "YZ: BTCUSDT (AL)")
  details?: string;            // Teknik detaylar (RSI, Trend vb.)
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  assetSymbol?: string;        // Portfolio filtreleme için sembol
  meta?: {
    aiScore?: number;
    regime?: string;
    veto?: string;
    insight?: string;
    // ... diğer teknik veriler
  };
}
```

---

## İş Akışı (Parsing)

1. **`extractMetaData`**: Ham JSON string içerisinden indikatörleri (`rsi`, `mfi`), AI skorlarını ve `veto_reason` bilgilerini çıkarır.
2. **`formatLogMessage`**: Sinyal tipine göre (Buy, Sell, Whale vb.) başlık string'ini oluşturur.
3. **Sentiment Analizi**: Sinyalin yönüne göre renk kodlaması (Yeşil/Kırmızı/Nötr) belirler.
4. **Timeframe Normalizasyonu**: "1M", "15m" gibi süreleri standartlaştırır.

---

## Bağlantılar

- **Bileşen:** [[entities/CombatLog|CombatLog UI]]
- **Servis:** [[entities/ApiCoreService|ApiCore]]
- **Konsept:** [[concepts/SignalNormalization|Sinyal Normalizasyonu]]
