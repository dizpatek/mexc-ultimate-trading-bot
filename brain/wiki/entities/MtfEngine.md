---
title: MtfEngine
tags: [entity, mtf, consensus, timeframe]
sourceFile: src/lib/mtf-engine.ts
size: "6KB / 181 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🕐 MtfEngine

**Dosya:** `src/lib/mtf-engine.ts`
**Kullanılan:** [[entities/MatrixV5Strategy|MatrixV5Strategy]]

Multi-Timeframe consensus hesaplama motoru.

---

## Key Function

```typescript
getMtfConsensus(
  symbol: string,
  currentTimeframe: string,
  engineBullCount: number
): Promise<{
  mtfScore: number,      // [-100, +100]
  verdictText: string,   // "GÜÇLÜ BOĞA" vb.
  nearestScore: number   // Yakın TF skoru
}>
```

---

## Bağlantılar

- **Kavram:** [[concepts/MTF-Consensus|MTF Consensus]]
- **Akış:** [[flows/01-signal-flow|Sinyal Akışı]]
