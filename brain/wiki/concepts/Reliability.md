---
title: Sistem Güvenilirliği (Reliability)
tags: [concept, architecture, core]
lastUpdated: 2026-04-11
type: concept
---

# 🛡️ Sistem Güvenilirliği (Reliability)

MexCBrain'in kesintisiz ve hatasız çalışmasını sağlayan mimari prensiplerdir.

## Temel Direkler
- **Merkezi İstek Yönetimi**: [[entities/ApiCoreService|ApiCoreService]] üzerinden kontrollü trafik.
- **Hata Yakalama**: 401/500 hatalarının kullanıcıya ve sisteme yansıması.
- **Timeout Optimizasyonu**: Yanıt vermeyen servislerin sistemi kilitlemesini önleyen 10s kuralı.

## Bağlantılar
- [[entities/ApiCoreService|ApiCoreService]]
- [[entities/api|API Utility]]
