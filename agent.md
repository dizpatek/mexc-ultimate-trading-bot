This file provides guidelines for AI agents working on the MexC Ultimate Trading Bot codebase.
Build / Lint / Test Commands
Development
npm run dev # Start Next.js dev server (http://localhost:3000)
npm run build # Production build
npm run start # Start production server
npm run lint # Run ESLint
Database
npm run db:init # Initialize Vercel Postgres database
Telegram Signal Listener (Python)
npm run telegram:start # Start Telegram listener
npm run telegram:dev # Alias for telegram:start
Running a Single Test
Note: This project currently has no test framework (no Jest, Vitest, or test files). Do not write tests unless explicitly requested by the user.
Environment Setup
Create .env.local with required variables:
MEXC_KEY=your_mexc_key
MEXC_SECRET=your_mexc_secret
POSTGRES_URL=your_postgres_url
JWT_SECRET=your_super_secret_jwt_key
WEBHOOK_SECRET=your_webhook_auth_secret
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
MIN_USDT_BALANCE=10
DEFAULT_TRADE_USDT=10

---

Code Style Guidelines
General

- Use TypeScript with strict mode enabled
- Use ESM modules (Next.js App Router)
- Use absolute imports with @/ prefix (e.g., @/lib/mexc)
- All paths must be absolute (no relative imports like ../lib)
  File Naming
- Components: PascalCase (e.g., PortfolioSummary.tsx, HoldingsTable.tsx)
- Utilities/Lib: camelCase (e.g., mexc.ts, strategies.ts, db.ts)
- API Routes: kebab-case with route.ts (e.g., portfolio/summary/route.ts)
- Pages: page.tsx for route pages, layout.tsx for layouts
  Imports
  React Components
  // Use named imports
  import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
  import { usePortfolioSummary, useHoldings } from '@/hooks/usePortfolio';
  // Export as named export
  export const PortfolioSummary = () => { ... }
  Libraries
  import axios from 'axios';
  import { NextResponse } from 'next/server';
  import crypto from 'crypto';
  import qs from 'qs';
  Absolute Imports
  import { getAccountInfo, getPrice, get24hrTicker } from '@/lib/mexc-wrapper';
  import { getSessionUser } from '@/lib/auth-utils';
  TypeScript
  Type Definitions
- Define interfaces near usage or in dedicated types files
- Use explicit return types for API routes
- Avoid any; use unknown if type is uncertain
  // Good
  export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  }
  // API routes - explicit return types
  export async function GET(request: Request) {
  try {
  // ...
  return NextResponse.json({ totalValue: 100 });
  } catch (error: any) {
  return NextResponse.json({ error: error.message }, { status: 500 });
  }
  }
  React / Next.js
  Client Components
  Add "use client" directive at the top of any component using hooks:
  "use client";
  import { useState } from 'react';
  export const MyComponent = () => { ... }
  API Routes (Route Handlers)
- Use dynamic = 'force-dynamic' for dynamic routes
- Always wrap in try/catch
- Return proper error responses with status codes
  export const dynamic = 'force-dynamic';
  export async function GET(request: Request) {
  try {
  const data = await someAsyncOperation();
  return NextResponse.json(data);
  } catch (error: any) {
  console.error('Error:', error.message);
  return NextResponse.json({ error: error.message }, { status: 500 });
  }
  }
  Tailwind CSS
- Use utility classes with CSS variables
- Follow existing color scheme (primary, secondary, muted, destructive)
- Use portfolio-container class for card-like elements
<div className="portfolio-container p-6">
    <h3 className="text-sm font-medium text-muted-foreground">Title</h3>
    <p className="text-3xl font-bold">$1,000</p>
</div>
Error Handling
- Always wrap async operations in try/catch
- Log errors with context: console.error('Operation failed:', error.message)
- Return meaningful error messages to API consumers
- Use fallback values for graceful degradation
  async function getPrice(symbol: string): Promise<number> {
  try {
  const data = await publicGet<{ price: string }>('/api/v3/ticker/price', { symbol });
  return parseFloat(data.price);
  } catch (e) {
  // Fallback values for common assets
  if (symbol === 'BTCUSDT') return 95000;
  if (symbol === 'ETHUSDT') return 3500;
  return 0;
  }
  }
  Naming Conventions
  | Type | Convention | Example |
  |------|------------|---------|
  | Components | PascalCase | PortfolioSummary |
  | Functions | camelCase | getAccountInfo, calculateRSI |
  | Variables | camelCase | totalValue, holdingsList |
  | Interfaces | PascalCase | TickerData, StrategySignal |
  | Constants | UPPER_SNAKE_CASE | BASE_URL, DEFAULT_LIMIT |
  | File names | kebab-case | open-orders, portfolio-summary |
  Python Guidelines (Telegram Listener)
  Follow telegram_listener.py conventions:
- Use type hints
- Use docstrings for functions
- Snake_case for variables and functions
- Handle gracefully exceptions
  async def send_signal_to_api(signal: Dict[str, Any]) -> bool:
  """Send signal to Next.js API"""
  try:
  async with aiohttp.ClientSession() as session:
  async with session.post(NEXTJS_API_URL, json=signal) as response:
  return response.status == 200
  except Exception as e:
  print(f"Failed to send signal to API: {e}")
  return False

---

Project Structure
src/
├── app/ # Next.js pages & API routes
│ ├── api/ # API routes (Route Handlers)
│ │ ├── portfolio/ # Portfolio endpoints
│ │ ├── trade/ # Trading endpoints
│ │ ├── strategies/ # Strategy management
│ │ └── ...
│ ├── login/ # Login page
│ └── settings/ # Settings page
├── components/ # React UI components
│ ├── PortfolioSummary.tsx
│ ├── HoldingsTable.tsx
│ └── ...
├── lib/ # Core logic
│ ├── mexc.ts # MEXC API wrapper
│ ├── mexc-wrapper.ts # Higher-level MEXC functions
│ ├── db.ts # Database utilities
│ ├── strategies.ts # Trading strategies
│ ├── indicators.ts # Technical indicators
│ └── ...
├── hooks/ # Custom React hooks
│ ├── usePortfolio.ts
│ ├── useAuth.ts
│ └── useMexcWebSocket.ts
├── services/ # API client service
├── contexts/ # React contexts
└── styles/ # Global styles

---

Common Patterns
Fetching Data with TanStack Query
const { data, isLoading, isError } = usePortfolioSummary();
Protected API Routes
export async function GET(request: Request) {
const user = await getSessionUser(request);
if (!user) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// Proceed with authenticated operation
}
Database Queries
Use @vercel/postgres with SQL for database operations. See src/lib/db.ts for patterns.

---

Important Notes

1. No Test Framework: Do not write tests unless explicitly requested.
2. Trading Bot: This is a financial application - be careful with real money operations.
3. API Keys: Never commit secrets to version control.
4. MEXC API: All trading goes through MEXC exchange API.
5. Vercel Postgres: Primary database for persistent storage.
