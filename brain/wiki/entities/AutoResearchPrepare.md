---
title: "AutoResearch — Data Preparation"
tags: [ai, data, preprocessing]
sourceFile: ../AutoResearch/prepare.py
lastUpdated: 2026-04-11
type: entity
size: "15KB / 390 satır"
---

# AutoResearch — Data Preparation

`prepare.py` dosyası, eğitim verisini tokenize eder ve model için hazırlar.

## Sorumluluklar
- Ham metin verisini byte-pair encoding (BPE) ile tokenize etme.
- Train/validation split oluşturma.
- Binary `.bin` dosyalarını diske yazma.

## Bağımlılıklar
- [[AutoResearchTrain|Train Engine]] tarafından tüketilir.

## Kullanım
```bash
uv run prepare.py   # ~2 dakika sürer
```

## Notlar
- Bu dosya **değiştirilMEMELİdir** (program.md kuralı).
- Sadece veri kaynağı değiştiğinde yeniden çalıştırılır.
