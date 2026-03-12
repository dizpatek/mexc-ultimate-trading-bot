import { sql } from "@/lib/postgres";
import { marketSellByQty, marketBuyByQuote } from "./mexc-wrapper";

import { OrderResult } from "./mexc";
import { determineExecutionStrategy } from "./engine/execution";

export interface ExecutionTrade {
  id: number;
  user_id: number;
  symbol: string;
  side: "BUY" | "SELL" | string;
  qty: number | string;
  price: number | string;
  meta: Record<string, unknown>;
  status?: string;
  trading_mode?: "test" | "production";
}

export async function executeEntry(
  trade: ExecutionTrade,
  currentPrice: number,
  reason: string,
  metaParam: Record<string, unknown>
) {
  const { id, user_id, symbol, qty: rawQty } = trade;
  const side = trade.side as string;
  const qty = Number(rawQty);
  try {
    // Evaluate execution strategy before placing order
    const executionStrategy = determineExecutionStrategy({
      direction: side === "BUY" ? "BUY" : "SELL",
      intendedPrice: currentPrice,
      urgency: "NORMAL",
      orderbook: { bidVolume: 100, askVolume: 100, spreadPct: 0.05 },
      maxSlippagePctConfig: 0.1,
    });
    console.log(`[Execution] Strategy for ${symbol}: ${executionStrategy.orderType}`, executionStrategy.warnings);

    let result: OrderResult | undefined;
    let avgPrice = currentPrice;
    if (side === "BUY")
      result = await marketBuyByQuote(
        user_id,
        symbol,
        (qty * currentPrice).toFixed(6),
        trade.trading_mode as any,
      );
    else
      result = await marketSellByQty(
        user_id,
        symbol,
        qty.toFixed(8).replace(/\.?0+$/, ""),
        trade.trading_mode as any,
      );

    if (
      result?.cummulativeQuoteQty &&
      result?.executedQty &&
      parseFloat(result.executedQty as string) > 0
    ) {
      avgPrice =
        parseFloat(result.cummulativeQuoteQty as string) /
        parseFloat(result.executedQty as string);
    }
    const metaPayload = metaParam.payload as Record<string, any>;
    const tradeMode = metaPayload?.mode || 'TRADE';
    const tradeState = tradeMode === 'COVER' ? 'COVER_SOLD' : 'TRADE_ACTIVE';

    await sql`UPDATE orders SET status = 'FILLED', price = ${avgPrice}, updated_at = ${Date.now()}, meta = (meta::jsonb || ${JSON.stringify({ ...metaParam, entryReason: reason, entryResult: result, highestPrice: avgPrice, lowestPrice: avgPrice, filledAt: Date.now(), tradeState })}::jsonb)::text WHERE id = ${id}`;
  } catch (err) {
    console.error(`[Entry Error]`, err);
    throw err; // Re-throw so monitor catches it and records the monitorError correctly
  }
}

export async function executeExit(
  trade: ExecutionTrade,
  currentPrice: number,
  reason: string,
  meta: Record<string, unknown>,
  currentQty: number,
) {
  const { id, user_id, symbol, side } = trade;
  try {
    let result: OrderResult | undefined;
    if (side === "BUY")
      result = await marketSellByQty(
        user_id,
        symbol,
        currentQty.toFixed(8).replace(/\.?0+$/, ""),
        trade.trading_mode as any,
      );
    else
      result = await marketBuyByQuote(
        user_id,
        symbol,
        (currentQty * currentPrice).toFixed(6),
        trade.trading_mode as any,
      );

    let realExitPrice = currentPrice;
    let executedQty = currentQty;

    if (
      result?.cummulativeQuoteQty &&
      result?.executedQty &&
      parseFloat(result.executedQty as string) > 0
    ) {
      executedQty = parseFloat(result.executedQty as string);
      realExitPrice =
        parseFloat(result.cummulativeQuoteQty as string) / executedQty;
    }

    const metaPayload = meta.payload as Record<string, any>;
    const tradeMode = metaPayload?.mode || 'TRADE';
    const tradeState = tradeMode === 'COVER' ? 'COVER_COMPLETED' : 'TRADE_COMPLETED';

    await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = ${JSON.stringify({ ...meta, exitReason: reason, exitResult: result, exitPrice: Number(realExitPrice), executedQty: Number(executedQty), closedAt: Date.now(), tradeState })} WHERE id = ${id}`;
  } catch (err) {
    console.error(`[Exit Error]`, err);
    throw err;
  }
}

export async function executePartialTP(
  trade: ExecutionTrade,
  currentPrice: number,
  currentQty: number,
  exec: { qty: number; targetIndex: number },
  meta: Record<string, unknown>,
  metaUpdates: Record<string, unknown>,
  tpTriggered: boolean,
) {
  let newQty = currentQty;
  if (typeof exec.qty !== "number" || isNaN(exec.qty) || exec.qty <= 0)
    return { newQty, tpTriggered };
  try {
    const isLong = trade.side === "BUY";
    const qtyStr = exec.qty.toFixed(8).replace(/\.?0+$/, "");
    const res: OrderResult | undefined = isLong
      ? await marketSellByQty(trade.user_id, trade.symbol, qtyStr, trade.trading_mode as any)
      : await marketBuyByQuote(
          trade.user_id,
          trade.symbol,
          (exec.qty * currentPrice).toFixed(6),
          trade.trading_mode as any,
        );
    const executed = parseFloat(
      (res?.executedQty as string) || String(exec.qty),
    );
    newQty -= executed;
    const filled =
      (metaUpdates.filledTargets as number[]) ||
      (meta.filledTargets as number[]) ||
      [];
    if (!filled.includes(exec.targetIndex)) filled.push(exec.targetIndex);
    metaUpdates.filledTargets = filled;
  } catch (err) {
    console.error(`[Partial TP Fail]`, err);
  }
  return { newQty, tpTriggered };
}

export async function saveTradeUpdate(
  id: number,
  qty: number,
  meta: Record<string, unknown>,
) {
  await sql`
        UPDATE orders 
        SET qty = ${qty}, 
            meta = (meta::jsonb || ${JSON.stringify(meta)}::jsonb)::text,
            updated_at = ${Date.now()}
        WHERE id = ${id}
    `;
}
