/**
 * Trading Simulator - Test Mode Trading Engine
 * Provides simulated trading functionality for testing without risking real assets
 */
import { normalizeSymbol, extractBaseAsset } from "@/lib/symbol-utils";

interface SimulatedBalance {
  asset: string;
  free: number;
  locked: number;
}

interface SimulatedOrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity?: number;
  quoteOrderQty?: number;
  price?: string;
  status: "NEW" | "FILLED" | "PARTIALLY_FILLED" | "CANCELED";
  executedQty: string;
  cummulativeQuoteQty: string;
  timestamp: number;
}

export const INITIAL_PORTFOLIO = [
  { s: 'USDT', q: 10000.00 },
  { s: 'BTC',  q: 0.15 },
  { s: 'ETH',  q: 2.85 },
  { s: 'SOL',  q: 66.00 },
  { s: 'BNB',  q: 16.00 },
  { s: 'XRP',  q: 16000.0 },
  { s: 'ADA',  q: 20000.0 },
  { s: 'DOGE', q: 66000.0 },
  { s: 'AVAX', q: 250.0 },
  { s: 'LINK', q: 650.0 },
  { s: 'DOT',  q: 1400.0 },
];

export const DEFAULT_TIMEFRAME_SETTINGS = {
  pilot_tp_percent: 1.0,
  pilot_sl_percent: 0.5,
  cover_tp_percent: 0.5,
  cover_sl_percent: 0.3,
  cover_tp_trailing: true,
  cover_tp_deviation: 0.3,
  cover_sl_trailing: false,
  cover_sl_deviation: 1.0
};

/**
 * P4.4: BalanceManager - Encapsulates balance and ledger management.
 * Separates asset tracking from execution logic.
 */
class BalanceManager {
  private balances: Map<string, SimulatedBalance> = new Map();

  constructor() {
    this.initializeTestBalance();
  }

  initializeTestBalance() {
    INITIAL_PORTFOLIO.forEach((item) => {
      this.balances.set(item.s, { asset: item.s, free: item.q, locked: 0 });
    });
  }

  loadBalances(balances: SimulatedBalance[]) {
    this.balances.clear();
    balances.forEach((b) => this.balances.set(b.asset, b));
  }

  setBalance(asset: string, free: number, locked: number = 0) {
    this.balances.set(asset, { asset, free, locked });
  }

  getAllBalances(): SimulatedBalance[] {
    return Array.from(this.balances.values());
  }

  getBalance(asset: string): SimulatedBalance {
    const b = this.balances.get(asset);
    if (!b) return { asset, free: 0.0, locked: 0.0 };
    return b;
  }

  updateBalance(asset: string, freeDelta: number) {
    const b = this.getBalance(asset);
    b.free += freeDelta;
    this.balances.set(asset, b);
  }

  getAccountInfo() {
    const balances = this.getAllBalances().map((b) => ({
      asset: b.asset,
      free: b.free.toString(),
      locked: b.locked.toString(),
    }));

    return {
      makerCommission: 10,
      takerCommission: 10,
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      balances,
    };
  }

  reset() {
    this.balances.clear();
    this.initializeTestBalance();
  }
}

export class TradingSimulator {
  private balanceManager: BalanceManager = new BalanceManager();
  private orders: Map<string, SimulatedOrder> = new Map();
  private orderIdCounter: number = 1000;
  private userId: number;

  constructor(userId: number = 1) {
    this.userId = userId;
  }

  public loadBalances(balances: SimulatedBalance[]) {
    this.balanceManager.loadBalances(balances);
  }

  public getAllBalances(): SimulatedBalance[] {
    return this.balanceManager.getAllBalances();
  }

  getAccountInfo() {
    return this.balanceManager.getAccountInfo();
  }

  getBalance(asset: string) {
    return this.balanceManager.getBalance(asset);
  }

  async executeMarketBuy(
    symbol: string,
    quoteOrderQty: number,
    currentPrice: number,
  ): Promise<SimulatedOrder> {
    // Extract base and quote assets robustly
    const cleanSymbol = normalizeSymbol(symbol);
    const quoteAsset = cleanSymbol.endsWith("USDT") ? "USDT" : "USDC";
    const baseAsset = extractBaseAsset(cleanSymbol);

    const quoteBalance = this.getBalance(quoteAsset);
    
    // P4.1: Standardize "Force Close" - cap buy to available balance if insufficient
    // Use a small epsilon for floating point precision checks
    const EPSILON = 0.000001;
    let actualQuoteQty = quoteOrderQty;
    if (quoteBalance.free < quoteOrderQty - EPSILON) {
      console.warn(
        `[Simulator/FORCE_BUY] ${symbol}: Insufficient ${quoteAsset}. Available: ${quoteBalance.free}, Requested: ${quoteOrderQty}. Capping to available balance.`,
      );
      actualQuoteQty = quoteBalance.free;
    }

    if (actualQuoteQty <= 0) {
      // In simulate mode, we still return a failed-like order if literal zero, but normally we just cap
      actualQuoteQty = Math.max(0, actualQuoteQty);
    }

    const fee = actualQuoteQty * 0.001;
    const netAmount = actualQuoteQty - fee;
    const quantity = netAmount / currentPrice;

    // Update balances via Manager
    this.balanceManager.updateBalance(quoteAsset, -actualQuoteQty);
    this.balanceManager.updateBalance(baseAsset, quantity);

    // P4.2: Semantic honesty - if we couldn't spend the full amount, it's a PARTIAL fill
    const isPartial = actualQuoteQty < quoteOrderQty - EPSILON;

    // Create order record
    const orderId = `SIM${this.orderIdCounter++}`;
    const order: SimulatedOrder = {
      orderId,
      symbol: cleanSymbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: actualQuoteQty,
      price: currentPrice.toString(),
      status: isPartial ? "PARTIALLY_FILLED" : "FILLED",
      executedQty: quantity.toString(),
      cummulativeQuoteQty: actualQuoteQty.toString(),
      timestamp: Date.now(),
    };

    this.orders.set(orderId, order);
    return order;
  }

  /**
   * Execute a MARKET BUY order by specifying the exact quantity of base asset to receive.
   * Fees are added on top of the quote amount spent.
   */
  async executeMarketBuyByBaseQty(
    symbol: string,
    quantity: number,
    currentPrice: number,
  ): Promise<SimulatedOrder> {
    const cleanSymbol = normalizeSymbol(symbol);
    const quoteAsset = "USDT";
    const baseAsset = extractBaseAsset(cleanSymbol);
    const quoteBalance = this.getBalance(quoteAsset);

    // Standard inclusive fee: user spends (quantity * price) and receives (quantity * 0.999)
    const quoteNeeded = quantity * currentPrice;
    let actualQuoteQty = quoteNeeded;

    // Cap to available balance
    if (actualQuoteQty > quoteBalance.free) {
      console.warn(`[Simulator/FORCE_BUY] ${symbol}: Capping to available balance ${quoteBalance.free}`);
      actualQuoteQty = quoteBalance.free;
    }

    const fee = actualQuoteQty * 0.001;
    const netAmount = actualQuoteQty - fee;
    const actualQuantity = netAmount / currentPrice;

    // Update balances via Manager
    this.balanceManager.updateBalance(quoteAsset, -actualQuoteQty);
    this.balanceManager.updateBalance(baseAsset, actualQuantity);

    // P3.1: Semantic honesty - if we couldn't get the full amount, it's a PARTIAL fill
    const isPartial = actualQuantity < quantity - 0.000001; 

    const orderId = `SIM${this.orderIdCounter++}`;
    const order: SimulatedOrder = {
      orderId,
      symbol: cleanSymbol,
      side: "BUY",
      type: "MARKET",
      price: currentPrice.toString(),
      status: isPartial ? "PARTIALLY_FILLED" : "FILLED",
      executedQty: actualQuantity.toString(),
      cummulativeQuoteQty: actualQuoteQty.toString(),
      timestamp: Date.now(),
    };

    this.orders.set(orderId, order);
    return order;
  }

  async executeMarketSell(
    symbol: string,
    quantity: number,
    currentPrice: number,
  ): Promise<SimulatedOrder> {
    const cleanSymbol = normalizeSymbol(symbol);
    console.log(
      `[Simulator] Executing Market Sell: ${quantity} ${cleanSymbol} @ ${currentPrice}`,
    );

    const quoteAsset = cleanSymbol.endsWith("USDT") ? "USDT" : "USDC";
    const baseAsset = extractBaseAsset(cleanSymbol);

    const baseBalance = this.getBalance(baseAsset);
    console.log(
      `[Simulator] Selling ${baseAsset}. Current balance: ${baseBalance.free}, Requested: ${quantity}`,
    );

    if (baseBalance.free < quantity) {
      const diff = quantity - baseBalance.free;
      const diffPercent = diff / quantity;

      // In TEST mode, if requested quantity is higher than balance,
      // we ALWAYS sell what we have instead of rejecting (P1.1 - Force Close).
      // This prevents trades from getting stuck in open state due to minor balance discrepancies.
      console.log(
        `[Simulator] Sell Requested: ${quantity}, Available: ${baseBalance.free}. Difference: ${diffPercent.toFixed(4)}%`,
      );
      console.log(
        `[Simulator] P1.1 Force: Selling all available ${baseAsset} balance (${baseBalance.free}) to close trade in TEST mode.`,
      );
      quantity = baseBalance.free;
    }

    const grossAmount = quantity * currentPrice;
    const fee = grossAmount * 0.001;
    const netAmount = grossAmount - fee;

    // Update balances via Manager
    this.balanceManager.updateBalance(baseAsset, -quantity);
    this.balanceManager.updateBalance(quoteAsset, netAmount);

    console.log(
      `[Simulator] After Sell - ${baseAsset} was debited by ${quantity}, ${quoteAsset} credited by ${netAmount}`,
    );

    // Create order record
    const orderId = `SIM${this.orderIdCounter++}`;
    const order: SimulatedOrder = {
      orderId,
      symbol: cleanSymbol,
      side: "SELL",
      type: "MARKET",
      quantity,
      price: currentPrice.toString(),
      status: "FILLED",
      executedQty: quantity.toString(),
      cummulativeQuoteQty: grossAmount.toString(),
      timestamp: Date.now(),
    };

    this.orders.set(orderId, order);
    return order;
  }

  getOpenOrders(symbol?: string) {
    const openOrders = Array.from(this.orders.values()).filter(
      (order) => order.status === "NEW" || order.status === "PARTIALLY_FILLED",
    );

    if (symbol) {
      return openOrders.filter((order) => order.symbol === symbol);
    }

    return openOrders;
  }

  cancelOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "FILLED") {
      throw new Error("Cannot cancel filled order");
    }

    order.status = "CANCELED";
    return order;
  }

  resetInMemoryState() {
    this.balanceManager.reset();
    this.orders.clear();
    this.orderIdCounter = 1000;
  }

  // Get portfolio value in USDT
  async getPortfolioValue(
    priceGetter: (symbol: string) => Promise<number>,
  ): Promise<number> {
    const assets = this.balanceManager.getAllBalances();
    
    // P4.2: Parallelize price fetching to avoid sequential I/O bottlenecks
    const pricePromises = assets.map(async (b) => {
      // USDT/USDC are pegged to 1 for valuation purposes
      if (b.asset === "USDT" || b.asset === "USDC") return (b.free + b.locked);
      // Skip empty balances
      if (b.free + b.locked === 0) return 0;
      
      try {
        const price = await priceGetter(`${b.asset}USDT`);
        return (b.free + b.locked) * price;
      } catch {
        return 0;
      }
    });

    const values = await Promise.all(pricePromises);
    return values.reduce((sum, val) => sum + val, 0);
  }
}

declare global {
  var simulatorInstances: Map<number, TradingSimulator> | undefined;
}

// P4.3: Basic instance management to prevent memory leaks
const MAX_SIMULATORS = 100;

// Singleton instances retrieval per user
export function getSimulator(userId: number = 1): TradingSimulator {
  if (!globalThis.simulatorInstances) {
    globalThis.simulatorInstances = new Map();
  }

  if (!globalThis.simulatorInstances.has(userId)) {
    // Evict oldest if we exceed threshold
    if (globalThis.simulatorInstances.size >= MAX_SIMULATORS) {
      const firstKey = globalThis.simulatorInstances.keys().next().value;
      if (firstKey !== undefined) globalThis.simulatorInstances.delete(firstKey);
    }
    
    globalThis.simulatorInstances.set(userId, new TradingSimulator(userId));
  }
  return globalThis.simulatorInstances.get(userId)!;
}

export function invalidateSimulator(userId: number = 1) {
  if (globalThis.simulatorInstances) {
    // P4.1: Explicitly invalidate by deleting the instance.
    // This forces the next getSimulator() call to re-sync from the freshly wiped database.
    globalThis.simulatorInstances.delete(userId);
  }
}

/**
 * P4.1: Extracted database reset logic. Handles cleanup, configuration reset, and portfolio re-initialization.
 */
export async function resetSimulatorDatabase(userId: number) {
  const { sql, pool } = await import("@/lib/postgres");

  // P4.2: Optimized parallel cleanup for independent tables
  const parallelCleanup = [
    sql`DELETE FROM trade_history WHERE user_id = ${userId}`,
    sql`DELETE FROM orders WHERE user_id = ${userId}`,
    sql`DELETE FROM portfolio_snapshots WHERE user_id = ${userId}`,
    // MUST delete alarm_logs before alarms because it uses a subquery on alarms
    sql`DELETE FROM alarm_logs WHERE alarm_id IN (SELECT id FROM alarms WHERE user_id = ${userId})`,
  ];

  try {
    // P4.1 & P4.2: Robust parallel cleanup (excluding portfolio to avoid re-init conflicts)
    const results = await Promise.allSettled(parallelCleanup);
    const failures = results.filter((r) => r.status === "rejected");

    if (failures.length > 0) {
      console.warn(
        `[Reset] Cleanup had ${failures.length} partial failures, continuing...`,
      );
    }

    // Now safe to delete alarms
    await sql`DELETE FROM alarms WHERE user_id = ${userId}`;

    // P3.1: Sequential delete for portfolio table to ensure clean state before re-init
    await sql`DELETE FROM portfolio WHERE user_id = ${userId}`;

    // P4.5: Reset global configuration to requested defaults instead of deleting
    await sql`
      UPDATE bot_configs 
      SET 
        f4_length = 10,
        whale_multiplier = 1.8,
        ai_threshold = 65,
        auto_trade = false,
        defense_mode = false,
        pilot_trailing_buy = true,
        pilot_trailing_buy_dev = 0.3,
        pilot_tp_trailing = true,
        pilot_tp_deviation = 1.0,
        pilot_sl_trailing = true,
        pilot_sl_deviation = 0.5,
        pilot_timeframe = '4h',
        fibo_length = 20,
        pilot_mtf_veto = true,
        pilot_mtf_threshold = 60,
        pilot_only_holdings = false,
        timeframe_settings = ${JSON.stringify(DEFAULT_TIMEFRAME_SETTINGS)}::jsonb
      WHERE id = 1
    `;

    console.log(
      `[Reset] Reset cleanup and config restore successfully completed.`,
    );
  } catch (e: unknown) {
    console.warn(
      `[Reset] Cleanup encountered errors: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 3. Re-initialize with ~$110,000 scaled multi-asset Portfolio from centralized constants
  // P4.1: Optimized single batched initialization to reduce latency and connections
  const timeStr = Date.now();
  const values: unknown[] = [];
  const placeholders = INITIAL_PORTFOLIO.map((asset, i) => {
    // Exactly 6 parameters per row inserted (user_id, symbol, balance, type, created_at, updated_at)
    const o = i * 6;
    values.push(userId, asset.s, asset.q, "SIMULATOR", timeStr, timeStr);
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`;
  }).join(", ");

  const queryText = `
    INSERT INTO portfolio (user_id, symbol, balance, type, created_at, updated_at)
    VALUES ${placeholders}
    ON CONFLICT (user_id, symbol, type) DO UPDATE 
    SET balance = EXCLUDED.balance, updated_at = EXCLUDED.updated_at
  `;

  try {
    await pool.query(queryText, values);
    console.log(
      `[Reset] Normalized portfolio restored (${INITIAL_PORTFOLIO.length} assets).`,
    );
  } catch (e: unknown) {
    console.error(
      `[Reset] Failed to initialize portfolio assets:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export type { SimulatedBalance, SimulatedOrder };
