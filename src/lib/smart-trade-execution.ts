import { sql } from "@/lib/postgres";
import { marketSellByQty, marketBuyByQuote } from "./mexc-wrapper";

import { OrderResult } from "./mexc";

export interface ExecutionTrade {
  id: number;
  user_id: number;
  symbol: string;
  side: "BUY" | "SELL" | string;
  qty: number | string;
  price: number | string;
  meta: Record<string, unknown>;
  status?: string;
}

export async function executeEntry(
  trade: ExecutionTrade,
  currentPrice: number,
  reason: string,
) {
  const { id, user_id, symbol, qty: rawQty, meta } = trade;
  const side = trade.side as string;
  const qty = Number(rawQty);
  try {
    let result: OrderResult | undefined;
    let avgPrice = currentPrice;
    if (side === "BUY")
      result = await marketBuyByQuote(
        user_id,
        symbol,
        (qty * currentPrice).toFixed(6),
      );
    else
      result = await marketSellByQty(
        user_id,
        symbol,
        qty.toFixed(8).replace(/\.?0+$/, ""),
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
    await sql`UPDATE orders SET status = 'FILLED', price = ${avgPrice}, updated_at = ${Date.now()}, meta = ${JSON.stringify({ ...meta, entryReason: reason, entryResult: result, highestPrice: avgPrice, lowestPrice: avgPrice, filledAt: Date.now() })} WHERE id = ${id}`;
  } catch (err) {
    console.error(`[Entry Error]`, err);
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
      );
    else
      result = await marketBuyByQuote(
        user_id,
        symbol,
        (currentQty * currentPrice).toFixed(6),
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

    await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = ${JSON.stringify({ ...meta, exitReason: reason, exitResult: result, exitPrice: Number(realExitPrice), executedQty: Number(executedQty), closedAt: Date.now() })} WHERE id = ${id}`;
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
      ? await marketSellByQty(trade.user_id, trade.symbol, qtyStr)
      : await marketBuyByQuote(
          trade.user_id,
          trade.symbol,
          (exec.qty * currentPrice).toFixed(6),
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
