// src/lib/engine/execution.ts

export interface OrderbookDepth {
  bidVolume: number; // Volume on the closest N bid levels
  askVolume: number; // Volume on the closest N ask levels
  spreadPct: number; // (Ask - Bid) / Bid * 100
}

export interface ExecutionIntent {
  direction: "BUY" | "SELL";
  intendedPrice: number;
  urgency: "HIGH" | "NORMAL" | "LOW"; // Urgency derived from AI signals
  orderbook: OrderbookDepth;
  maxSlippagePctConfig: number;
}

export interface ExecutionStrategy {
  orderType: "MARKET" | "LIMIT" | "TWAP";
  limitPriceOffsetPct: number; // If limit, how much to offset from intended
  estimatedSlippagePct: number;
  warnings: string[];
}

export function determineExecutionStrategy(intent: ExecutionIntent): ExecutionStrategy {
  const warnings: string[] = [];
  let orderType: "MARKET" | "LIMIT" | "TWAP" = "LIMIT";
  let offset = 0;
  let estimatedSlippage = 0;

  // 1. Analyze Spread and Liquidity
  const tightSpread = intent.orderbook.spreadPct < 0.05; // 0.05% spread is good

  // 2. Imbalance Check
  const isBuyImbalance = intent.orderbook.bidVolume > intent.orderbook.askVolume * 2;
  const isSellImbalance = intent.orderbook.askVolume > intent.orderbook.bidVolume * 2;

  // 3. Execution Logic
  if (intent.urgency === "HIGH") {
    // We need to enter immediately, but watch out for extreme slippage
    if (intent.orderbook.spreadPct > intent.maxSlippagePctConfig) {
      warnings.push("High spread detected during High Urgency. Reverted to Limit.");
      orderType = "LIMIT";
      offset = intent.direction === "BUY" ? intent.orderbook.spreadPct * 0.5 : -intent.orderbook.spreadPct * 0.5;
    } else {
      orderType = "MARKET";
      estimatedSlippage = intent.orderbook.spreadPct;
    }
  } else if (intent.urgency === "NORMAL") {
    if (tightSpread && ((intent.direction === "BUY" && isBuyImbalance) || (intent.direction === "SELL" && isSellImbalance))) {
      // Flow is with us, safe to take market
      orderType = "MARKET";
      estimatedSlippage = intent.orderbook.spreadPct;
    } else {
      // Flow against us or spread is wide, use Limit Order
      orderType = "LIMIT";
      offset = 0; // At best bid/ask
    }
  } else {
    // LOW urgency (e.g. accumulation, scaling out)
    orderType = "TWAP";
    warnings.push("Low urgency detected. Using time-weighted average price strategy.");
  }

  if (estimatedSlippage > intent.maxSlippagePctConfig) {
    warnings.push(`Slippage (${estimatedSlippage.toFixed(2)}%) exceeds max allowed (${intent.maxSlippagePctConfig}%)`);
    orderType = "LIMIT";
    offset = 0; 
  }

  return {
    orderType,
    limitPriceOffsetPct: offset,
    estimatedSlippagePct: estimatedSlippage,
    warnings,
  };
}
