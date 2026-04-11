---
title: Emir Yönetimi (OrderManagement)
tags: [concept, trading, orders]
lastUpdated: 2026-04-11
type: concept
---

# 📝 Emir Yönetimi (OrderManagement)

Sistemdeki manuel ve otomatik emirlerin yaşam döngüsünü yöneten mantıksal katmandır.

## Temel Kurallar
1. **Precision**: Fiyat ve miktar basamak sayısının borsa kurallarına göre yuvarlanması.
2. **Min Amount**: MEXC min işlem limiti (~5 USDT) kontrolü.
3. **Execution**: Emrin borsa API'sine iletilmesi ve sonucun [[entities/CombatLog|CombatLog]]'a yazılması.

## Bağlantılar
- [[entities/SmartTradeLogicHook|SmartTradeLogicHook]]
- [[entities/TradePanel|TradePanel]]
