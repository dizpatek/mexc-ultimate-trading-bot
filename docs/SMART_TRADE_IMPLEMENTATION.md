# SmartTrade Implementation - 3Commas Compatibility

This document describes the SmartTrade module implementation that is fully compatible with 3Commas trailing mechanisms.

## Implemented Features

### 1. Order Types

| Type                  | Description                               | Status       |
| --------------------- | ----------------------------------------- | ------------ |
| **Limit Order**       | Placed at specific price in order book    | ✅ Supported |
| **Market Order**      | Instant execution at best available price | ✅ Supported |
| **Conditional Order** | Triggered when price reaches target       | ✅ Supported |

### 2. Trailing Buy (Takipli Alış)

**Purpose:** Buy at the lowest possible price during a downtrend.

**Mechanism:**

1. Set trigger price and deviation %
2. When price drops to trigger, trailing activates
3. Track the lowest price
4. Buy when price bounces up by deviation % from lowest point

**Example:**

```
Current BTC Price: $34,360
Trigger Price: $33,500
Deviation: 1%

1. Price drops to $33,500 → Trailing activates
2. Price continues to $33,000 → Trailing tracks this bottom
3. Price rises to $33,330 (1% from $33,000) → BUY executed
```

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:104-178)

### 3. Trailing Take Profit (TTP)

**Purpose:** Maximize profit by trailing price increases.

**Mechanism:**

1. Price reaches TP target → TTP activates
2. Track highest price
3. Sell when price drops by deviation % from highest point

**Formula:**

```
Trailing Stop Price = Highest Price × (1 - Trailing Deviation %)
```

**Example:**

```
Entry Price: $1,000
TP Target: +10% = $1,100
Trailing Deviation: 2%

1. Price reaches $1,100 → TTP activates, stop = $1,078
2. Price rises to $1,150 → stop moves to $1,127
3. Price drops to $1,127 → SELL executed
Result: +12.7% profit (vs +10% with fixed TP)
```

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:247-324)

### 4. Trailing Stop Loss (TSL)

**Purpose:** Protect profits while allowing upside potential.

**Formula (3Commas AEP-based):**

```
Trail Value = Average Entry Price × SL%
New SL = Highest Price - Trail Value
```

**Key Rules:**

- Trail distance is FIXED (based on AEP)
- SL only moves UP, never down
- If AEP changes (additional buys), trail value recalculates

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:197-244)

### 5. Move to Breakeven

**Purpose:** Protect capital after first TP target.

**Mechanism:**

- Requires at least 2 TP targets
- When first TP triggers → SL moves to entry price
- Remaining position protected from loss

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:188-195)

### 6. Stop Loss Timeout (Wick Protection)

**Purpose:** Filter fake-outs and wicks.

**Mechanism:**

1. Price drops below SL
2. Countdown starts (e.g., 10 seconds)
3. If price recovers above SL within timeout → Position stays open
4. If price stays below SL → Position closes

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:205-243)

### 7. Split Take Profit (Multiple Targets)

**Purpose:** Scale out of positions at multiple price levels.

**Features:**

- Up to 8 TP targets supported
- Each target has custom price and volume %
- Trailing TP only applies to LAST target

**Example:**

```
Target  Volume  Price
TP1     30%     $250
TP2     30%     $260
TP3     20%     $270
TP4     20%     $280 (Trailing TP applies here)
```

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:247-324)

### 8. Smart Cover (Short Mode)

**Purpose:** Sell high, buy back lower (inverse of Smart Trade).

**Features:**

- All trailing mechanisms work inversely
- Trailing Sell for entry (trail the top)
- Trailing TP tracks downward
- Trailing SL tracks upward

**Implementation:** [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts:326-436)

## Deviation Recommendations

Based on 3Commas guidelines:

| TP % | Recommended Deviation |
| ---- | --------------------- |
| +5%  | -1%                   |
| +8%  | -1.5%                 |
| +10% | -2%                   |
| +15% | -3%                   |

**Avoid:**

- Deviation ≥ TP % (zero profit)
- Deviation > TP/4 (high early exit risk)

## Synchronous Operation

The SmartTrade module operates synchronously across three components:

### 1. Smart Orders (UI)

- [`src/components/SmartTrade.tsx`](src/components/SmartTrade.tsx) - Order configuration UI
- [`src/components/ActiveSmartTrades.tsx`](src/components/ActiveSmartTrades.tsx) - Active trades display

### 2. Trade Execution

- [`src/app/api/trade/smart/route.ts`](src/app/api/trade/smart/route.ts) - API endpoint
- [`src/lib/smart-trade.ts`](src/lib/smart-trade.ts) - Trade execution logic

### 3. Chart Integration

- [`src/components/SmartChart.tsx`](src/components/SmartChart.tsx) - Visual price levels
- Real-time trailing deviation display
- Drag-and-drop price adjustment

### Monitoring Engine

- [`src/lib/smart-trade-monitor.ts`](src/lib/smart-trade-monitor.ts) - Background monitoring
- [`src/app/api/cron/trailing-stop/route.ts`](src/app/api/cron/trailing-stop/route.ts) - Cron trigger

## API Endpoints

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| `/api/trade/smart`        | POST   | Create new SmartTrade    |
| `/api/trade/smart`        | GET    | List active trades       |
| `/api/trade/smart`        | PUT    | Update trade settings    |
| `/api/trade/smart`        | DELETE | Close/Cancel trade       |
| `/api/cron/trailing-stop` | GET    | Trigger monitoring cycle |

## Database Schema

SmartTrades are stored in the `orders` table with `meta.smartTrade = true`:

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,  -- 'BUY' or 'SELL'
    type TEXT NOT NULL,  -- 'MARKET', 'LIMIT', etc.
    qty DECIMAL NOT NULL,
    price DECIMAL NOT NULL,
    status TEXT NOT NULL,  -- 'PENDING', 'FILLED', 'CLOSED'
    meta JSONB,  -- Contains smartTrade config
    created_at BIGINT,
    updated_at BIGINT
);
```

## Testing

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## References

- [3commas.md](../3commas.md) - Original 3Commas documentation
- [3Commas Help Center](https://help.3commas.io/) - Official documentation
