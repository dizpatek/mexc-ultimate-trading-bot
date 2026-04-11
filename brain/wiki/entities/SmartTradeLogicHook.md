---
title: SmartTradeLogicHook
tags: [hook, trade, execution, logic]
sourceFile: src/hooks/useSmartTradeLogic.ts
size: "9KB / 210 satır"
lastUpdated: 2026-04-11
type: entity
---

# 🤖 SmartTradeLogicHook

**Dosya:** `src/hooks/useSmartTradeLogic.ts`
**Kullanım:** Manuel işlem paneli ve otopilot onay mekanizmalarında kullanılır.

---

## Ana Görev

Kullanıcının manuel olarak veya Pilot'un otomatik olarak işlem açma/kapatma taleplerini yönetir. Bakiyelerin kontrol edilmesi, emir tiplerinin (Limit/Market) saptanması ve işlemin MEXC borsasına iletilmeden önceki son mantıksal doğrulamasını yapar.

---

## Public API

```typescript
function useSmartTradeLogic() {
  return {
    handleOrder: (params) => Promise<Result>, // Emir oluştur
    handleCancel: (id) => Promise<boolean>,   // Emir iptal
    isProcessing: boolean                     // İşlem devam ediyor mu?
  }
}
```

---

## Önemli Metodlar

### `handleOrder()`
Bir sinyali veya manuel girişi alıp aşağıdaki adımları yönetir:
1. **Bakiye Kontrolü**: USDT miktarının yeterliliği.
2. **Precision Ayarları**: Sembolün borsa üzerindeki fiyat/miktar hassasiyeti.
3. **API Çağrısı**: [[entities/ApiCoreService|ApiCore]] üzerinden emrin gönderilmesi.
4. **Hata Yakalama**: Borsa hatalarının (insufficient balance, min trade amount vb.) yakalanıp kullanıcıya bildirilmesi.

---

## Bağlantılar

- **Akış:** [[flows/03-execution-flow|İşlem Akışı]]
- **Servis:** [[entities/MexcWrapper|MexcWrapper]]
- **Bileşen:** [[entities/TradePanel|İşlem Paneli]]
- **Konsept:** [[concepts/OrderManagement|Emir Yönetimi]]
