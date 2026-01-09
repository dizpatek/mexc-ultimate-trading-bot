# MexC Ultimate Portfolio

An advanced crypto portfolio tracking and automated trading dashboard built with Next.js 15+, TypeScript, and Tailwind CSS v4.

## Features

- **Real-time Portfolio Tracking**: Connects to MEXC API to fetch balances, prices, and open orders.
- **Automated Trading Strategies**: Support for RSI, MACD, and Moving Average Crossover strategies.
- **Webhook Integration**: Receive trade signals from external sources (like TradingView).
- **Portfolio Analytics**: Track daily performance, profit/loss, and historical snapshots.
- **Modern UI**: Sleek, responsive dashboard with dark mode support.
- **Database**: Backend powered by Vercel Postgres for reliable data storage.

## Tech Stack

- **Frontend**: Next.js (App Router), React 19, Tailwind CSS v4, Lucide React, Recharts.
- **Backend**: Next.js API Routes (Route Handlers), TypeScript.
- **Data Fetching**: Tanstack Query (React Query), Axios.
- **Authentication**: JWT-based auth with Bcrypt for password hashing.
- **Database**: `@vercel/postgres`.

## Getting Started

### Prerequisites

- Node.js 20+
- MEXC API Key & Secret
- Vercel Postgres Database

### Environment Variables

Create a `.env.local` file in the root directory and add the following:

```env
# MEXC API
MEXC_KEY=your_mexc_key
MEXC_SECRET=your_mexc_secret

# Database (Vercel Postgres)
POSTGRES_URL=your_postgres_url

# Security
JWT_SECRET=your_super_secret_jwt_key
WEBHOOK_SECRET=your_webhook_auth_secret

# Telegram (Optional)
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading Settings (Optional)
MIN_USDT_BALANCE=10
DEFAULT_TRADE_USDT=10
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

- `src/app`: Next.js pages and API routes.
- `src/components`: Reusable UI components.
- `src/lib`: Core logic (MEXC API, Database, Trading, Indicators, Strategies).
- `src/hooks`: Custom React hooks for data fetching and auth.
- `src/services`: API client service.
- `scripts`: SQL schema and other utility scripts.

## License

MIT
