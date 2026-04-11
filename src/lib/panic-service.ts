// Last Updated: 2026-01-24T02:23:00+03:00
import { sql } from "@/lib/postgres";
import {
  getAccountInfo,
  marketSellByQty,
  getTradingMode,
  type TradingMode,
} from "@/lib/mexc-wrapper";
import { normalizeSymbol } from "@/lib/symbol-utils";

interface SellResult {
  asset: string;
  success: boolean;
  quantity?: number;
  usdtReceived?: number;
  error?: string;
}

export async function executePanicSell(
  userId: string | number,
  forcedMode?: TradingMode,
) {
  try {
    const tradingMode = forcedMode || getTradingMode();
    console.log(
      `[PanicService] Initiating Panic Sell for user ${userId} in ${tradingMode.toUpperCase()} mode`,
    );

    // Get all current balances (works in both test and production mode)
    const accountInfo = await getAccountInfo(Number(userId), tradingMode);
    console.log(
      `[PanicService] Total balances found: ${accountInfo.balances.length}`,
    );

    // Filter assets: >0 balance and not USDT/USDC
    const activeBalances = (accountInfo.balances || []).filter(
      (b: { asset: string; free: string; locked: string }) => {
        const total = parseFloat(b.free) + parseFloat(b.locked);
        const isTradable =
          total > 0 && b.asset !== "USDT" && b.asset !== "USDC";
        if (isTradable)
          console.log(
            `[PanicService] Tradable asset found: ${b.asset} (${total})`,
          );
        return isTradable;
      },
    );

    if (activeBalances.length === 0) {
      console.log(
        "[PanicService] No active assets to sell. Balances were:",
        JSON.stringify(accountInfo.balances),
      );
      return {
        success: false,
        message: "No assets to sell",
        totalUsdtValue: 0,
        mode: tradingMode,
      };
    }

     
    const snapshotData: any[] = [];
    const sellResults: SellResult[] = [];
    let totalUsdtValue = 0;

    // Sell all assets
    for (const balance of activeBalances) {
      const asset = balance.asset;
      const quantity = parseFloat(balance.free);

      if (quantity <= 0) {
        console.log(
          `[PanicService] Skipping ${asset} due to 0 free balance (locked: ${balance.locked})`,
        );
        continue;
      }

      try {
        const symbol = normalizeSymbol(asset);
        console.log(
          `[PanicService] Selling ${quantity} ${asset} as ${symbol}...`,
        );

         
        const sellResult: any = await marketSellByQty(
          Number(userId),
          symbol,
          String(quantity),
          tradingMode,
        );
        console.log(
          `[PanicService] ${asset} Sell Result:`,
          JSON.stringify(sellResult),
        );

        // Simulation uses executedQuote, production uses cummulativeQuoteQty
        const usdtReceived = parseFloat(
          sellResult.cummulativeQuoteQty || sellResult.executedQuote || "0",
        );
        totalUsdtValue += usdtReceived;

        console.log(
          `[PanicService] Sold ${asset}: +${usdtReceived} USDT (Mode: ${tradingMode}, Total: ${totalUsdtValue})`,
        );

        snapshotData.push({
          asset,
          quantity,
          symbol,
          usdtValue: usdtReceived,
          orderId: sellResult.orderId,
        });

        sellResults.push({
          asset,
          success: true,
          quantity,
          usdtReceived,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[PanicService] Failed to sell ${asset}:`, message);
        sellResults.push({
          asset,
          success: false,
          error: message,
        });
      }
    }

    console.log(
      `[PanicService] Panic Sell Cycle Complete. Total USDT Received: ${totalUsdtValue}`,
    );

    // Save snapshot to database (Snapshots track what was sold, regardless of mode)
    try {
      const timestamp = Date.now();
      await sql`
                INSERT INTO panic_snapshots (user_id, snapshot_data, total_usdt_value, created_at)
                VALUES (${Number(userId)}, ${JSON.stringify(snapshotData)}, ${totalUsdtValue}, ${timestamp})
            `;
      console.log(`[PanicService] Snapshot saved for user ${userId}`);
    } catch (dbError) {
      console.error("[PanicService] Failed to save snapshot:", dbError);
    }

    return {
      success: true,
      totalUsdtValue,
      results: sellResults,
      soldCount: sellResults.filter((r) => r.success).length,
      mode: tradingMode,
    };
  } catch (error: unknown) {
    console.error("[PanicService] Critical error:", error);
    throw error;
  }
}
