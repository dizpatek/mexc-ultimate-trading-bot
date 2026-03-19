import { getSetting, setSetting } from "./settings";
import { TradingSimulator, getSimulator } from "./trading-simulator";
import {
  getTradingMode,
  getTradingModeSync,
  setTradingModeClient,
} from "./trading-mode";
import type { TradingMode } from "./trading-mode";
import { INITIAL_PORTFOLIO } from "./trading-simulator";

export { getTradingMode, getTradingModeSync, setTradingModeClient };
export type { TradingMode };

const _lastSavePromises = new Map<number, Promise<void>>();
const _syncPromises = new Map<number, Promise<void>>();
const _lastSaveTime = new Map<number, number>();
const MAX_SYNC_MAP_SIZE = 500;

export async function syncSimulator(
  userId: number,
  simulator: TradingSimulator,
) {
  if (typeof window !== "undefined") return;

  // P4.2: Prevent memory leak by capping map size
  if (_syncPromises.size >= MAX_SYNC_MAP_SIZE) {
    const firstKey = _syncPromises.keys().next().value;
    if (firstKey !== undefined) _syncPromises.delete(firstKey);
  }

  const existingSync = _syncPromises.get(userId);
  if (existingSync) return existingSync;

  const syncPromise = (async () => {
    try {
      // One-time check: If already migrated to V3, we only check for consistency
      const migrated = await getSetting("SIM_V3_MIGRATED", userId);

      const saved = await getSetting("SIMULATED_BALANCES", userId);
      if (saved) {
        const balances = JSON.parse(saved);
        // P2: Force migration if the portfolio is not diversified (less than 8 assets)
        if (Array.isArray(balances) && balances.length < 8) {
          const names = balances.map((b: { asset: string }) => b.asset).join(", ");
          console.log(
            `[Simulator] Under-diversified portfolio for user ${userId} (${balances.length} assets: ${names}). Forcing V3 migration...`,
          );

          // Force update with 11 assets directly to bypass stale reset() methods in cached instances
          simulator.loadBalances(
            INITIAL_PORTFOLIO.map((asset) => ({
              asset: asset.s,
              free: asset.q,
              locked: 0,
            })),
          );

          const newBalances = simulator.getAllBalances();
          await setSetting(
            "SIMULATED_BALANCES",
            JSON.stringify(newBalances),
            userId,
          );
          await setSetting("SIM_V3_MIGRATED", "true", userId);
          return;
        }

        if (!migrated) {
          console.log(`[Simulator] Setting migration flag to V3 for user ${userId} (already diversified).`);
          await setSetting("SIM_V3_MIGRATED", "true", userId);
        }
        simulator.loadBalances(balances);
      } else {
        // No saved state found, start fresh
        console.log(`[Simulator] No saved balances for user ${userId}. Initializing Defaults...`);
        simulator.resetInMemoryState();
        await setSetting(
          "SIMULATED_BALANCES",
          JSON.stringify(simulator.getAllBalances()),
          userId,
        );
        await setSetting("SIM_V3_MIGRATED", "true", userId);
      }
    } catch (err) {
      console.error(`[Simulator] Sync failed for user ${userId}:`, err);
    } finally {
      // Cleanup the promise after completion or failure
      _syncPromises.delete(userId);
    }
  })();

  _syncPromises.set(userId, syncPromise);
  return syncPromise;
}

function queueBalancePersistence(userId: number, simulator: TradingSimulator) {
  if (typeof window !== "undefined") return;
  
  const now = Date.now();
  _lastSaveTime.set(userId, now);
  
  // P4.1: Non-chaining "Last-Win" persistence to prevent promise backlog.
  // We capture the snapshot synchronously.
  const balancesSnapshot = Array.from(simulator.getAllBalances().values());

  // we await the PREVIOUS TASK if it exists to avoid concurrent database writes,
  // but we don't chain .then() infinitely to avoid backlog.
  const existingTask = _lastSavePromises.get(userId);
  
  const currentTask = (async () => {
    try {
      // Wait for any prior save to finish to avoid concurrent write issues
      if (existingTask) await existingTask.catch(() => {});
      
      // P4.4: If a newer save was started while we were waiting, this snapshot is stale. Skip.
      if (_lastSaveTime.get(userId) !== now) return;

      await setSetting("SIMULATED_BALANCES", JSON.stringify(balancesSnapshot), userId);
    } catch (err) {
      console.error(`[Simulator] Persistence failed for user ${userId}:`, err);
    }
  })();

  _lastSavePromises.set(userId, currentTask);

  // cleanup outside the main async body to avoid reference/hoisting errors
  currentTask.finally(() => {
    if (_lastSavePromises.get(userId) === currentTask) {
      _lastSavePromises.delete(userId);
    }
  });
}

import { OrderResult } from "./mexc";

let _mexcModule: typeof import("./mexc") | null = null;
async function getMexcModule() {
  if (!_mexcModule) _mexcModule = await import("./mexc");
  return _mexcModule;
}

export async function getPrice(symbol: string): Promise<number> {
  const { getPrice: getMexcPrice } = await getMexcModule();
  return getMexcPrice(symbol);
}

export async function get24hrTicker(symbol: string) {
  const { get24hrTicker: getMexcTicker } = await getMexcModule();
  return getMexcTicker(symbol);
}

export async function getTopAssets(limit: number = 20) {
  const { getTopAssets: getMexcTopAssets } = await getMexcModule();
  return getMexcTopAssets(limit);
}

export async function getKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 500,
) {
  const { getKlines: getMexcKlines } = await getMexcModule();
  return getMexcKlines(symbol, interval, limit);
}

export async function getAccountInfo(
  userId: number,
  mode: TradingMode = "test",
) {
  const finalMode = String(mode).toLowerCase();
  if (finalMode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    return simulator.getAccountInfo();
  }
  
  const { getAccountInfo: getMexcAccount } = await getMexcModule();
  return getMexcAccount(userId);
}


export async function getHoldings(userId: number, mode: TradingMode = "test") {
  const account = await getAccountInfo(userId, mode);
  return account.balances || [];
}

export async function getOpenOrders(
  userId: number,
  symbol: string | null = null,
  mode: TradingMode = "test",
) {
  if (mode === "test") {
    const simulator = getSimulator(userId);
    return simulator.getOpenOrders(symbol || undefined);
  }
  const { getOpenOrders: getMexcOpenOrders } = await getMexcModule();
  return getMexcOpenOrders(userId, symbol);
}

export async function marketBuyByQuote(
  userId: number,
  symbol: string,
  quoteQty: string,
  modeOverride?: TradingMode,
): Promise<OrderResult> {
  const mode = modeOverride || getTradingMode();
  if (mode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    const currentPrice = await getPrice(symbol);
    const res = await simulator.executeMarketBuy(
      symbol,
      parseFloat(quoteQty),
      currentPrice,
    );
    queueBalancePersistence(userId, simulator);
    return res as unknown as OrderResult;
  }
  const { marketBuyByQuote: mexcBuy } = await getMexcModule();
  return mexcBuy(userId, symbol, quoteQty);
}

export async function marketBuyByQty(
  userId: number,
  symbol: string,
  qty: string,
  modeOverride?: TradingMode,
): Promise<OrderResult> {
  const mode = modeOverride || getTradingMode();
  if (mode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    const currentPrice = await getPrice(symbol);
    const res = await simulator.executeMarketBuyByBaseQty(symbol, parseFloat(qty), currentPrice);
    queueBalancePersistence(userId, simulator);
    return res as unknown as OrderResult;
  }
  const { marketBuyByQty: mexcBuy } = await getMexcModule();
  return mexcBuy(userId, symbol, qty);
}

export async function marketSellByQty(
  userId: number,
  symbol: string,
  qty: string,
  modeOverride?: TradingMode,
): Promise<OrderResult> {
  const mode = modeOverride || getTradingMode();
  if (mode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    const currentPrice = await getPrice(symbol);
    const res = await simulator.executeMarketSell(
      symbol,
      parseFloat(qty),
      currentPrice,
    );
    queueBalancePersistence(userId, simulator);
    return res as unknown as OrderResult;
  }
  const { marketSellByQty: mexcSell } = await getMexcModule();
  return mexcSell(userId, symbol, qty);
}

export async function getBalance(
  asset: string,
  userId: number,
  mode: TradingMode = "test",
) {
  if (mode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    return simulator.getBalance(asset);
  }
  const { getBalance: getMexcBalance } = await getMexcModule();
  return getMexcBalance(asset, userId);
}

export async function placeStopMarket(
  userId: number,
  pair: string,
  side: string,
  stopPrice: string,
  qty: string,
  modeOverride?: TradingMode,
) {
  const mode = modeOverride || getTradingMode();
  if (mode === "test") {
    // Simple simulator market entry for now
    return postOrder(userId, pair, side, qty, stopPrice, "MARKET", mode);
  }
  const { placeStopMarket: mexcStop } = await getMexcModule();
  return mexcStop(userId, pair, side, stopPrice, qty);
}

export async function postOrder(
  userId: number,
  symbol: string,
  side: string,
  qty: string,
  _price: string,
  type: string = "MARKET",
  modeOverride?: TradingMode,
) {
  const mode = modeOverride || getTradingMode();
  if (mode === "test") {
    const simulator = getSimulator(userId);
    await syncSimulator(userId, simulator);
    const currentPrice = await getPrice(symbol);

    if (type.toUpperCase() !== "MARKET") {
      console.warn(`[Simulator] ${type} order @ ${_price} requested for ${symbol}. Falling back to MARKET execution for simulation.`);
    } else {
      console.log(`[Simulator] Posting MARKET ${side} for ${symbol}. Qty: ${qty}`);
    }

    if (side.toUpperCase() === "BUY") {
      const res = await simulator.executeMarketBuyByBaseQty(
        symbol,
        parseFloat(qty),
        currentPrice,
      );
      queueBalancePersistence(userId, simulator);
      return res;
    } else {
      const res = await simulator.executeMarketSell(
        symbol,
        parseFloat(qty),
        currentPrice,
      );
      queueBalancePersistence(userId, simulator);
      return res;
    }
  }
  const { postOrder: mexcPost } = await getMexcModule();
  return mexcPost(userId, { symbol, side, qty, price: _price, type });
}
