import { sql } from "@/lib/postgres";
import { marketSellByQty, marketBuyByQuote } from "./mexc-wrapper";

import { OrderResult } from "./mexc";
import { determineExecutionStrategy } from "./engine/execution";
import { registerPilotReEntry } from "./pilot-executor";

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

    // ── TRAILING BUY SL/TP DYNAMIC CALCULATION ─────────────────────────
    // If the executed entry price (avgPrice) is different from the payload's original buyPrice,
    // we must adjust the SL and TP absolute prices relative to the new execution price, 
    // keeping the original percentage distance intact.
    if (metaPayload?.buyPrice && Number(metaPayload.buyPrice) > 0) {
      const originalBuyPrice = Number(metaPayload.buyPrice);
      const isTrailingExecuted = metaPayload.trailingBuy === true && avgPrice !== originalBuyPrice;

      if (isTrailingExecuted) {
        if (metaPayload.stopLoss?.price) {
          const originalSl = Number(metaPayload.stopLoss.price);
          // Dist ratio = absolute difference / original element
          const slDistRatio = Math.abs(originalBuyPrice - originalSl) / originalBuyPrice;
          
          let newSl = originalSl;
          if (tradeMode === 'COVER') {
            newSl = avgPrice * (1 + slDistRatio); // SL is above for SHORT
          } else {
            newSl = avgPrice * (1 - slDistRatio); // SL is below for LONG
          }
          metaPayload.stopLoss.price = newSl.toString();
          metaParam.activeStopLoss = newSl;
          console.log(`[Execution] T-Buy SL Adjusted for ${symbol}: ${originalSl} -> ${newSl} (Exec: ${avgPrice})`);
        }

        if (metaPayload.takeProfit?.price) {
          const originalTp = Number(metaPayload.takeProfit.price);
          const tpDistRatio = Math.abs(originalBuyPrice - originalTp) / originalBuyPrice;
          
          let newTp = originalTp;
          if (tradeMode === 'COVER') {
            newTp = avgPrice * (1 - tpDistRatio); // TP is below for SHORT
          } else {
            newTp = avgPrice * (1 + tpDistRatio); // TP is above for LONG
          }
          metaPayload.takeProfit.price = newTp.toString();
          metaParam.activeTakeProfit = newTp;
          console.log(`[Execution] T-Buy TP Adjusted for ${symbol}: ${originalTp} -> ${newTp} (Exec: ${avgPrice})`);
        }
        
        metaParam.payload = metaPayload;
      }
    }

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

    // ═══════════════════════════════════════════════════════════════
    // PILOT RE-ENTRY HOOK: When a pilot_auto TRADE exits (sells),
    // register the USDT proceeds so the pilot can re-buy this asset
    // on the next BUY signal.
    // ═══════════════════════════════════════════════════════════════
    const source = (meta as any).source || metaPayload?.source;
    if (tradeMode === 'TRADE' && source === 'pilot_auto' && side === 'BUY') {
      // Calculate USDT proceeds from the sell
      const usdtProceeds = realExitPrice * executedQty;
      if (usdtProceeds >= 5) {
        registerPilotReEntry(user_id, symbol, usdtProceeds);
      }
    }

    // ── PERFORMANCE TRACKING ENHANCEMENT ──────────────────────────────
    // Calculate PnL based on entry price vs exit price
    const entryPrice = Number(trade.price || 0);
    let profitLoss = 0;
    let profitLossPercentage = 0;

    if (entryPrice > 0) {
      if (side === "BUY") {
        // Long exit: (Sell - Buy)
        profitLoss = (realExitPrice - entryPrice) * executedQty;
        profitLossPercentage = ((realExitPrice - entryPrice) / entryPrice) * 100;
      } else {
        // Short exit (Cover): (SellEntry - BuyExit)
        // Note: For Short, entry was a SELL, exit is a BUY
        profitLoss = (entryPrice - realExitPrice) * executedQty;
        profitLossPercentage = ((entryPrice - realExitPrice) / entryPrice) * 100;
      }
    }

    const { insertTradeHistory, calculateDailyPerformance } = await import("./db");
    
    // Update order status first
    await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = ${JSON.stringify({ ...meta, exitReason: reason, exitResult: result, exitPrice: Number(realExitPrice), executedQty: Number(executedQty), closedAt: Date.now(), tradeState, profitLoss, profitLossPercentage })} WHERE id = ${id}`;

    // Record in Trade History
    await insertTradeHistory({
      user_id: user_id,
      order_id: id,
      symbol: symbol,
      side: side === "BUY" ? "SELL" : "BUY", // The exit side
      type: "MARKET",
      qty: executedQty,
      price: realExitPrice,
      quote_qty: realExitPrice * executedQty,
      commission: 0, // Simplified, MEXC fills have this info if needed
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPercentage,
      created_at: Date.now()
    } as any);

    // Refresh daily performance metrics
    await calculateDailyPerformance(user_id).catch(e => console.error("[Performance] Calc failed:", e));
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

    // ── PARTIAL TP PERFORMANCE RECORDING ────────────────────────────
    const entryPrice = Number(trade.price || 0);
    const side = trade.side as string;
    let profitLoss = 0;
    let profitLossPercentage = 0;

    if (entryPrice > 0) {
      if (side === "BUY") {
        profitLoss = (currentPrice - entryPrice) * executed;
        profitLossPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else {
        profitLoss = (entryPrice - currentPrice) * executed;
        profitLossPercentage = ((entryPrice - currentPrice) / entryPrice) * 100;
      }
    }

    const { insertTradeHistory, calculateDailyPerformance } = await import("./db");
    
    await insertTradeHistory({
      user_id: trade.user_id,
      order_id: trade.id,
      symbol: trade.symbol,
      side: side === "BUY" ? "SELL" : "BUY",
      type: "PARTIAL_TP",
      qty: executed,
      price: currentPrice,
      quote_qty: currentPrice * executed,
      commission: 0,
      profit_loss: profitLoss,
      profit_loss_percentage: profitLossPercentage,
      created_at: Date.now()
    } as any);

    await calculateDailyPerformance(trade.user_id).catch(e => console.error("[Performance] Partial TP Calc fail:", e));

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
