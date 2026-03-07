# 🤖 MexC Ultimate Trading Bot & Portfolio Matrix V5.4 Neural

<p align="center">
  <img src="public/readme-assets/banner_v5.png" alt="Matrix V5 Neural Engine Banner" width="800">
</p>

![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS%204.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![Vercel](https://img.shields.io/badge/Vercel-Postgres-000000?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&logo=freebsd)

An elite, high-performance institutional-grade automated trading ecosystem. This repository represents a comprehensive evolution from the legacy V3 architecture to a state-of-the-art **Matrix V5 Neural Core**, featuring deep Smart Money Concepts (SMC) integration, high-concurrency API proxying, and intensive algorithmic optimizations.

---

## ⚡ Matrix V5 Neural Core: The Developmental Leap

The V5 transformation involves **thousands of lines of new logic** across the entire stack, shifting from a simple script-based bot to a distributed neural architecture.

### 🌐 Scalable API & Proxy Infrastructure (NEW)

- **📡 Institutional Proxy Batching**: Optimized `MarketKernel` executes intelligent request consolidation. Instead of individual per-asset calls, a centralized proxy system handles thousands of data points via batched MEXC API requests, reducing overhead by **~85%**.
- **⏱️ Deterministic Latency (500ms Throttle)**: A precision-engineered global throttle gate eliminates the risk of 429 (Rate Limit) errors while maintaining professional-grade execution speed.
- **🔇 Noise-Free Data Stream**: Removed all redundant high-frequency background '1m' polling. The entire system now utilizes a **Global Timeframe Sync** architecture.

### 🧠 Matrix V5 Neural Engine Architecture

- **🧬 6-Category Confluence Engine**: Final trading decisions are now determined by a weighted consensus across **Tech, Momentum, Volume, Trend, Market Regime, and Timing** categories.
- **� 12+ Institutional Indicators**: Native port of advanced Pine Script v6 strategies including:
  - **Trend**: SuperTrend, EMA Ribbon, Ichimoku Cloud.
  - **Momentum**: ADX Trend Strength, StochRSI, MACD Histogram (Divergence aware).
  - **Volume**: VPA (Volume Price Analysis), ADM (Asset Drift Model), Capital Flow Phase detection.
- **📐 SMC (Smart Money Concepts)**: Professional-grade structure analysis detecting **BOS** (Break of Structure), **CHoCH** (Change of Character), **Order Blocks**, and **Fair Value Gaps (FVG)**.
- **🔮 Probabilistic Forecasting**: Bayesian decision model providing directional probabilities (Up/Down/Flat) with confidence intervals.

---

## 🎮 tactical Dashboard (V5 Edition)

The V5 UI is a "Single Pane of Glass" command center built for high-stakes trading.

- **Neural Portfolio Matrix**: Live asset grid featuring **MTF Consensus**, AI Confidence scores (0-100), and the "Matrix Verdict" (e.g., _🔥 GÜÇLÜ AL — DİP ONAYLANMIŞ_).
- **SmartTrade Execution Deck**: Professional order management supporting **Trailing Take-Profit (TTP)**, **Trailing Stop-Loss (TSL)**, **Smart Cover**, and **Trailing Buy**.
- **Intelligence Hub (Global Feed)**: Aggregated news sentiment analysis paired with a real-time **Whale Radar v2** institutional tracking system.
- **CombatLog 2.0**: High-fidelity event stream with sentiment-coded signals, whale alerts, and structural break notifications.
- **🛡️ Automated Panic Switch**: Integrated emergency liquidation service that executes a one-click global exit and captures a database snapshot of current balances.

---

## 🚀 Full Technology Stack

| Layer         | Technology                                 |
| :------------ | :----------------------------------------- |
| **Framework** | Next.js 15+ (App Router), React 19         |
| **Logic**     | TypeScript 5.x (Strict Neural Engine)      |
| **Styling**   | Tailwind CSS v4.0 (Modern Tactical Theme)  |
| **Real-time** | High-Concurrency WebSocket Aggregator      |
| **Database**  | Vercel Postgres / Neon SQL Architecture    |
| **Security**  | Institutional HMAC-SHA256 MEXC API Signing |

---

## 🛠️ Configuration & Setup

### 📋 Prerequisites

- Node.js 20+ (LTS)
- MEXC Standard/Spot API Keys
- PostgreSQL Instance (Vercel/Neon)

### 📦 Installation

```bash
# Clone the Matrix V5 repository
git clone https://github.com/dizpatek/mexc-ultimate-trading-bot.git

# Initialize Neural Environment
npm install

# Database Setup
# Auto-initialization occurs on project launch via src/lib/db-init.ts

# Start System
npm run dev
```

---

## 🇹🇷 Türkçe Özet – Matrix V5 Neural: Geleceğin İşlem Teknolojisi

**Matrix V5**, eski V3 yapısını tamamen geride bırakarak profesyonel bir komuta merkezi sunar. Bu güncelleme, sistemin her dosyasında binlerce optimizasyon ve yapısal yenilik barındırır.

- **Ultra-Verimli API:** "Proxy Batching" teknolojisi ile MEXC limitlerine takılmadan binlerce veriyi saniyeler içinde işler.
- **Giga Master AI:** RSI, MACD ve Ichimoku gibi 12+ indikatörü Bayesyen olasılık modelleriyle birleştirerek en güvenli giriş noktalarını tespit eder.
- **SMC Desteği:** Kurumsal "Smart Money" stratejilerini (BOS, CHoCH, Likidite Bölgeleri) yerel olarak destekler.
- **SmartTrade Mekanizması:** Trailing Stop, Trailing TP ve Smart Cover algoritmalarıyla kârınızı korurken zarar riskini minimize eder.
- **Panic Exit:** Tek tıkla tüm portföyü USDT'ye çeviren acil durum sistemi.

---

## 📄 License

Licensed under the [MIT License](LICENSE).

---

> **⚠️ DISCLOSURE:** This software is for educational and research purposes only. Trading cryptocurrencies carries high risk. Past performance does not guarantee future results.
