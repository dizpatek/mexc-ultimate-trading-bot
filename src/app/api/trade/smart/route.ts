import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { monitorSmartTrades } from "@/lib/smart-trade-monitor";
import { handleSmartTrade } from "@/lib/smart-trade";
import { sql } from "@/lib/postgres";
import axios from "axios";
import {
  marketBuyByQuote,
  marketBuyByQty,
  marketSellByQty,
  type TradingMode,
} from "@/lib/mexc-wrapper";
import { getMexcCredentials } from "@/lib/settings";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Monitoring cooldown to prevent resource exhaustion during frequent polling (P4.2 fix)
let lastMonitorTime = 0;
const MONITOR_COOLDOWN_MS = 2000; // Reduced from 1m to 2s for extreme responsiveness

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check mode and credentials for GET too (since we fetch prices)
    const cookieStore = await cookies();
    const mode = (cookieStore.get("TRADING_MODE")?.value as TradingMode) || "test";

    // Fetch smart trades for this user only using SQL filtering (P5.4 optimization)
    const { rows } = await sql`
            SELECT id, user_id, symbol, side, type, qty, price, status, created_at, meta, trading_mode 
            FROM orders 
            WHERE user_id = ${user.id} 
              AND trading_mode = ${mode}
              AND (meta->>'smartTrade') = 'true'
            ORDER BY created_at DESC
        `;

    interface OrderRow {
      id: number;
      symbol: string;
      side: string;
      type: string;
      qty: string | number;
      price: string | number;
      status: string;
      created_at: string | number;
      meta: Record<string, any>;
    }

    // Collec active (non-closed) symbols to fetch live prices in a single batch
    const activeRows = (rows as unknown as Array<{id: number; symbol: string; status: string; meta: Record<string, any>; price: string | number; qty: string | number; side: string; created_at: string | number}>).filter(
      r => r.status !== "CLOSED" && r.status !== "ARCHIVED"
    );
    const uniqueActiveSymbols = [...new Set(activeRows.map(r => (r.symbol as string).replace("/", "").toUpperCase()))];
    
    // Fetch live prices for active trades only (batch call — 1 upstream request)
    let livePriceMap: Record<string, number> = {};
    if (uniqueActiveSymbols.length > 0) {
      livePriceMap = await fetchAllPrices(uniqueActiveSymbols);
    }

    const smartTrades = (rows as unknown as Array<{id: number; symbol: string; status: string; meta: Record<string, any>; price: string | number; qty: string | number; side: string; created_at: string | number}>).map((row) => {
      const meta = row.meta || {};
      const symClean = (row.symbol as string).replace("/", "").toUpperCase();
      const isClosed = row.status === "CLOSED" || row.status === "ARCHIVED";
      
      // Closed: use exitPrice from meta; Active: use live batch price → fallback to meta.lastPrice → fallback to entry
      const livePrice = !isClosed ? (livePriceMap[symClean] || livePriceMap[(row.symbol as string)] || 0) : 0;
      const exitPrice = isClosed ? (Number(meta.exitPrice) || Number(meta.exitResult?.price) || 0) : 0;
      const currentPrice = isClosed
        ? (exitPrice || Number(meta.lastPrice) || Number(row.price))
        : (livePrice || Number(meta.lastPrice) || Number(row.price));

      return {
        ...row,
        price: Number(row.price),
        qty: Number(row.qty),
        currentPrice,
        meta,
        created_at: typeof row.created_at === "string"
          ? parseInt(row.created_at) || Date.now()
          : Number(row.created_at) || Date.now(),
      };
    });

    return NextResponse.json(smartTrades);
  } catch (error: unknown) {
    console.error("SmartTrade GET Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}

async function fetchCurrentPrice(symbol: string): Promise<number | undefined> {
  try {
    const cleanSymbol = symbol.replace("/", "").toUpperCase();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const res = await fetch(
      `https://api.mexc.com/api/v3/ticker/price?symbol=${cleanSymbol}`,
      {
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);

    if (!res.ok) return undefined;
    const data = await res.json();
    const p = parseFloat(data.price);
    return isNaN(p) || p <= 0 ? undefined : p;
  } catch (e) {
    console.error(`Failed to fetch current price for ${symbol}`, e);
    return undefined;
  }
}

// New function to fetch all ticker prices in a single batch call
async function fetchAllPrices(symbols?: string[]): Promise<Record<string, number>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for batch call

    let url = `https://api.mexc.com/api/v3/ticker/price`;
    
    // P4.2: Only fetch what we need if symbols are provided
    if (symbols && symbols.length > 0) {
      const cleanSymbols = symbols.map(s => s.replace("/", "").toUpperCase());
      url += `?symbols=${JSON.stringify(cleanSymbols)}`;
    }

    const res = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(
        "Failed to fetch ticker prices:",
        res.status,
        res.statusText,
      );
      return {};
    }
    const dataRaw = await res.json();
    const data: Array<{ symbol: string; price: string }> = Array.isArray(dataRaw) ? dataRaw : [dataRaw];
    const priceMap: Record<string, number> = {};
    for (const item of data) {
      // P4.1: Strict validation of ticker items
      if (!item || typeof item !== "object" || !item.symbol || !item.price) continue;

      const p = parseFloat(item.price);
      if (!isNaN(p) && p > 0) {
        // Store BOTH BTCUSDT and BTC/USDT formats to ensure compatibility with various symbol storage styles
        const sym = item.symbol;
        priceMap[sym] = p;

        // If it's a USDT pair, also store with / format
        if (sym.endsWith("USDT")) {
          const base = sym.replace("USDT", "");
          priceMap[`${base}/USDT`] = p;
        }
      }
    }
    return priceMap;
  } catch (e) {
    console.error("Failed to fetch all ticker prices:", e);
    return {};
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";
    const silent = searchParams.get("silent") === "true";
    const now = Date.now();

    // P4.2: Ensure DELETE respects trading mode from cookies
    const cookieStore = await cookies();
    const mode =
      (cookieStore.get("TRADING_MODE")?.value as TradingMode) || "test";

    // P4.2: Production mode safety check
    if (mode === "production" && !silent) {
      const { apiKey, apiSecret } = await getMexcCredentials(
        Number(user.id),
        mode,
      );
      if (!apiKey || !apiSecret) {
        return NextResponse.json(
          {
            error:
              "Production mode requires API keys for panic close. Please configure them in Settings or use Silent Close.",
          },
          { status: 400 },
        );
      }
    }

    if (clearAll) {
      // Fetch all in-progress smart trades with full details for execution
      const { rows } = await sql`
                SELECT id, symbol, side, qty, status, meta FROM orders 
                WHERE user_id = ${user.id} AND status IN ('FILLED', 'PENDING', 'NEW', 'ACTIVE', 'OPEN')
            `;

      const smartRows = rows.filter((r) => {
        try {
          const m = typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta;
          return m?.smartTrade === true;
        } catch {
          return false;
        }
      });

      if (smartRows.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No smart trades to clear",
        });
      }

      // Fetch all prices in parallel with a local cache to avoid duplicates
      const symbolCache = new Map<string, Promise<number | undefined>>();
      const priceResults = await Promise.all(
        smartRows.map(async (row) => {
          if (!symbolCache.has(row.symbol as string)) {
            symbolCache.set(
              row.symbol as string,
              fetchCurrentPrice(row.symbol as string),
            );
          }
          const price = await symbolCache.get(row.symbol as string);
          return {
            id: row.id as number,
            price,
            meta: row.meta as unknown,
            side: row.side as string,
            qty: row.qty as number,
            symbol: row.symbol as string,
          } as CloseParams;
        }),
      );

      // Process in chunks of 5 to avoid overwhelming DB/API (P4.2 fix)
      const CHUNK_SIZE = 5;
      const outcomes: {
        id: number | string;
        success: boolean;
        error?: string;
      }[] = [];

      for (let i = 0; i < priceResults.length; i += CHUNK_SIZE) {
        const chunk = priceResults.slice(i, i + CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (trade) => {
            try {
              return await closeSingleSmartTrade(
                String(user.id),
                trade as CloseParams,
                now,
                silent,
                mode,
              );
            } catch (e) {
              return { id: trade.id, success: false, error: String(e) };
            }
          }),
        );
        outcomes.push(...results);
      }

      const successCount = outcomes.filter((o) => o.success).length;

      return NextResponse.json({
        success: true,
        message: `${successCount}/${smartRows.length} smart trades processed`,
        details: outcomes,
      });
    }

    const clearHistory = searchParams.get("clearHistory") === "true";
    if (clearHistory) {
      // First delete dependent trade_history records
      await sql`
                DELETE FROM trade_history 
                WHERE order_id IN (
                    SELECT id FROM orders 
                    WHERE user_id = ${user.id} AND status IN ('CLOSED', 'NEW', 'CANCELLED')
                    AND (meta::jsonb->>'smartTrade')::boolean = true
                )
            `;

      // Then delete the actual orders
      await sql`
                DELETE FROM orders 
                WHERE user_id = ${user.id} AND status IN ('CLOSED', 'NEW', 'CANCELLED')
                AND (meta::jsonb->>'smartTrade')::boolean = true
            `;
      return NextResponse.json({
        success: true,
        message: "Smart trade history cleared",
      });
    }

    if (!id && !clearAll)
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    // SearchParams handling done above

    if (id) {
      const { rows: tradeRows } =
        await sql`SELECT id, symbol, side, qty, status, meta FROM orders WHERE id = ${id} AND user_id = ${user.id}`;
      if (tradeRows.length === 0)
        return NextResponse.json({ error: "Trade not found" }, { status: 404 });

      const trade = tradeRows[0];
      const currentPrice = await fetchCurrentPrice(String(trade.symbol));

      const result = await closeSingleSmartTrade(
        String(user.id),
        {
          id: trade.id as number,
          symbol: trade.symbol as string,
          side: trade.side as string,
          qty: trade.qty as number,
          price: currentPrice,
          meta: trade.meta,
          status: trade.status as string,
        },
        now,
        silent,
        mode,
      );

      if (!result.success) {
        const message = result.error || "Failed";
        let status = 500;
        if (
          message.includes("Insufficient") ||
          message.includes("Balance") ||
          message.includes("configured")
        ) {
          status = 400;
        }
        return NextResponse.json(
          {
            error: status === 400 ? "Bad Request" : "Internal Server Error",
            message: message,
          },
          { status },
        );
      }

      return NextResponse.json({
        success: true,
        message: silent
          ? "Order archived silently"
          : "Order closed and position exited",
        exitPrice: currentPrice,
      });
    }
  } catch (error: unknown) {
    console.error("SmartTrade DELETE Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const payload = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Trade ID is required" },
        { status: 400 },
      );
    }

    // Fetch existing trade to get current meta (with user isolation)
    const user = await getSessionUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rows } =
      await sql`SELECT * FROM orders WHERE id = ${id} AND user_id = ${user.id}`; // User isolation verified
    if (rows.length === 0) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    const trade = rows[0];
    const existingMeta =
      typeof trade.meta === "string" ? JSON.parse(trade.meta) : trade.meta;

    // P4.2: Ensure PUT respects trading mode from cookies
    const cookieStore = await cookies();
    const mode =
      (cookieStore.get("TRADING_MODE")?.value as TradingMode) || "test";

    // Handle Flash Open - force immediate execution at market price
    if (payload.forceExecute === true) {
      // P4.2: Production mode safety check
      if (mode === "production") {
        const { apiKey, apiSecret } = await getMexcCredentials(
          Number(user.id),
          mode,
        );
        if (!apiKey || !apiSecret) {
          return NextResponse.json(
            {
              error:
                "Production mode requires API keys for flash open. Please configure them in Settings.",
            },
            { status: 400 },
          );
        }
      }

      const currentPrice = await fetchCurrentPrice(String(trade.symbol));
      if (!currentPrice) {
        return NextResponse.json(
          { error: "Could not fetch current price" },
          { status: 400 },
        );
      }

      // Disable trailingBuy and update payload
      const updatedPayload = {
        ...existingMeta.payload,
        trailingBuy: false,
        buyPrice: currentPrice.toString(),
      };

      const newMeta = {
        ...existingMeta,
        payload: updatedPayload,
        lastEditedAt: Date.now(),
      };

      // Execute the trade immediately at market price
      try {
        if (trade.side === "BUY") {
          const qty = parseFloat(String(trade.qty));
          const cost = qty * currentPrice;
          await marketBuyByQuote(
            Number(user.id),
            trade.symbol as string,
            cost.toFixed(2),
            mode,
          );
        } else {
          const qty = parseFloat(String(trade.qty))
            .toFixed(8)
            .replace(/\.?0+$/, "");
          await marketSellByQty(
            Number(user.id),
            trade.symbol as string,
            qty,
            mode,
          );
        }
      } catch (execError: unknown) {
        console.error("[FlashOpen] Execution failed:", execError);
        return NextResponse.json(
          {
            error: "Flash open execution failed",
            details:
              execError instanceof Error
                ? execError.message
                : String(execError),
          },
          { status: 500 },
        );
      }

      // Update order status to FILLED
      await sql`
                UPDATE orders 
                SET status = 'FILLED', price = ${currentPrice}, meta = ${JSON.stringify(newMeta)}::jsonb, updated_at = ${Date.now()}
                WHERE id = ${id} AND user_id = ${user.id}
            `;

      return NextResponse.json({
        success: true,
        message: "Flash open executed",
        price: currentPrice,
      });
    }

    // Normal PUT - just update metadata
    const newMeta = {
      ...existingMeta,
      payload: {
        ...existingMeta.payload,
        ...payload, // Only overwrite payload fields
      },
      lastEditedAt: Date.now(),
    };

    // Reset monitor tracking variables so the updated TP/SL take effect cleanly
    delete newMeta.activeTakeProfit;
    delete newMeta.activeStopLoss;
    delete newMeta.tpTriggered;
    delete newMeta.tslActivated;

    await sql`
            UPDATE orders 
            SET meta = ${JSON.stringify(newMeta)}::jsonb, updated_at = ${Date.now()}
            WHERE id = ${id} AND user_id = ${user.id}
        `;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("SmartTrade PUT Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log("[API] SmartTrade Request:", {
      symbol: payload.symbol,
      amount: payload.amount,
      mode: payload.mode,
    });

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read trading mode from payload directly first, then cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const modeCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("TRADING_MODE="));
    const tradingMode = payload.tradingMode ? (payload.tradingMode as "test" | "production") : (modeCookie
      ? (modeCookie.split("=")[1].trim() as "test" | "production")
      : "test");

    console.log("[API] Trading Mode:", tradingMode);

    // Validate required fields
    if (!payload.symbol || !payload.amount || !payload.mode) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["symbol", "amount", "mode"],
        },
        { status: 400 },
      );
    }

    const result = await handleSmartTrade(
      { ...payload, user_id: user.id },
      tradingMode,
    );

    console.log("[API] SmartTrade Result:", result);

    return NextResponse.json({
      success: true,
      message: "SmartTrade created successfully",
      result,
    });
  } catch (error: unknown) {
    console.error("[API] SmartTrade Route FATAL Error:", error);

    // Extract as much info as possible
    let message = "Unknown Error";
    let details = {};

    if (error instanceof Error) {
      message = error.message;
    }

    // Check if it's an Axios error from the MEXC API call inside handleSmartTrade
    if (axios.isAxiosError(error)) {
      details = error.response?.data || { message: error.message };
      console.error("[API] MEXC API Rejection Details:", details);
    }

    let status = 500;
    // Map common user/execution errors to 400 (Bad Request) instead of 500
    if (
      message.includes("Insufficient") ||
      message.includes("Balance") ||
      message.includes("configured") ||
      message.includes("credentials") ||
      message.includes("Invalid") ||
      message.includes("Limit") ||
      message.includes("Precision") ||
      message.includes("Minimum amount") ||
      message.includes("Filter") ||
      message.includes("determined")
    ) {
      status = 400;
    }

    return NextResponse.json(
      {
        error: status === 400 ? "Bad Request" : "Internal Server Error",
        message,
        details,
        stack:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : undefined
            : undefined,
      },
      { status },
    );
  }
}

interface CloseParams {
  id: number | string;
  symbol: string;
  side: string;
  qty: number | string;
  price?: number;
  meta: unknown;
  status?: string;
}

/**
 * Helper to close a single smart trade: executing market order + DB update
 */
async function closeSingleSmartTrade(
  userId: string | number,
  res: CloseParams,
  now: number,
  silent: boolean,
  mode: TradingMode = "test",
) {
  try {
    const id = Number(res.id);
    const uid = Number(userId);

    // --- REAL EXECUTION (Skip if silent OR if qty is zero/PENDING) ---
    const parsedQty = parseFloat(String(res.qty));
    const isPendingTrade = res.status === "PENDING" || parsedQty <= 0;

    if (!silent && !isPendingTrade) {
      try {
        if (res.side === "BUY") {
          // Standardized: Use marketSellByQty wrapper for long closure
          const sellQty = parsedQty
            .toFixed(8)
            .replace(/\.?0+$/, "");
          await marketSellByQty(uid, res.symbol, sellQty, mode);
        } else if (res.side === "SELL") {
          // Standardized: Use marketBuyByQty wrapper for short closure
          const buyQty = parsedQty
            .toFixed(8)
            .replace(/\.?0+$/, "");
          await marketBuyByQty(uid, res.symbol, buyQty, mode);
        }
      } catch (execError: unknown) {
        const msg =
          execError instanceof Error ? execError.message : String(execError);
        console.error(
          `[CloseTrade] exchange execution attempt failed for ${id} (${res.symbol}):`,
          msg,
        );

        // P4.1: If NOT silent, we must throw to prevent DB archival of a trade that failed to exit on exchange.
        // If silent=true, we ignore exchange errors because the user usually has already closed the trade manually.
        if (!silent) {
          throw execError;
        }
      }
    } else if (isPendingTrade) {
      console.log(`[CloseTrade] Skipping exchange call for PENDING/zero-qty trade ${id} — no position to close.`);
    }

    let existingMeta: Record<string, unknown> = {};
    try {
      existingMeta =
        typeof res.meta === "string" ? JSON.parse(res.meta) : res.meta || {};
    } catch {
      existingMeta = {};
    }

    const updatedMeta = JSON.stringify({
      ...existingMeta,
      closedAt: now,
      exitPrice: res.price || undefined,
      exitReason: silent ? "MANUAL_SILENT_EXIT" : "MANUAL_PANIC_EXIT",
    });

    await sql`
            UPDATE orders 
            SET status = 'CLOSED', updated_at = ${now}, meta = ${updatedMeta}::jsonb
            WHERE id = ${id} AND user_id = ${uid}
        `;
    return { id, success: true };
  } catch (err) {
    console.error(`[CloseTrade] DB update failed for ${res.id}:`, err);
    return { id: res.id, success: false, error: String(err) };
  }
}
