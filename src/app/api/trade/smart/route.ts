import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { monitorSmartTrades } from '@/lib/smart-trade-monitor';
import { handleSmartTrade } from '@/lib/smart-trade';
import { sql } from '@/lib/postgres';
import axios from 'axios';
import { getPrice, marketBuyByQuote, marketSellByQty, type TradingMode } from '@/lib/mexc-wrapper';
import { getMexcCredentials } from '@/lib/settings';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Trigger monitoring in the background whenever trades are fetched
        // This ensures prices are checked even if the cron job is pending
        void monitorSmartTrades();
        
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check mode and credentials for GET too (since we fetch prices)
        const cookieStore = await cookies();
        const mode = cookieStore.get('TRADING_MODE')?.value as TradingMode || 'test';
        
        if (mode === 'production') {
            const { apiKey, apiSecret } = await getMexcCredentials(user.id, mode);
            if (!apiKey || !apiSecret) {
                // Return 400 BUT also empty list to avoid breaking UI if not strict
                // Actually better to error so user knows why prices are 0 or missing
                return NextResponse.json({ 
                    error: 'Production mode requires API keys. Please configure them in Settings.' 
                }, { status: 400 });
            }
        }

        // Fetch orders for this user only
        const { rows } = await sql`
            SELECT id, user_id, symbol, side, type, qty, price, status, created_at, meta 
            FROM orders 
            WHERE user_id = ${user.id}
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
            meta: string | Record<string, unknown>;
        }

        const smartTradesRaw = (rows as unknown as OrderRow[]).map(row => {
            let parsedMeta: Record<string, unknown> = {};
            try {
                parsedMeta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
            } catch {
                parsedMeta = {};
            }
            return { 
                ...row, 
                price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
                qty: typeof row.qty === 'string' ? parseFloat(row.qty) : row.qty,
                meta: parsedMeta 
            };
        }).filter(row => row.meta.smartTrade === true);

        // Fetch current prices in parallel using MEXC V3 API
        const symbols = [...new Set(smartTradesRaw.map(t => t.symbol).filter(s => typeof s === 'string'))];
        const priceMap: Record<string, number> = {};
        
        if (symbols.length > 0) {
            await Promise.all(symbols.map(async (sym) => {
                try {
                    const cleanSymbol = sym.replace('/', '').toUpperCase();
                    // Use a short timeout for fetch
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    
                    const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${cleanSymbol}`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.price) {
                            priceMap[sym] = parseFloat(data.price);
                        }
                    }
                } catch (err) {
                    // Suppress per-symbol errors to allow partial success
                    console.warn(`[SmartTrade] Price fetch failed for ${sym}:`, err instanceof Error ? err.message : String(err));
                }
            }));
        }

        const smartTrades = smartTradesRaw.map(trade => ({
            ...trade,
            currentPrice: priceMap[trade.symbol] || trade.price,
            created_at: typeof trade.created_at === 'string' ? parseInt(trade.created_at) || Date.now() : (Number(trade.created_at) || Date.now())
        }));

        return NextResponse.json(smartTrades);
    } catch (error: unknown) {
        console.error('SmartTrade GET Error Trace:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}

async function fetchCurrentPrice(symbol: string): Promise<number | undefined> {
    try {
        const cleanSymbol = symbol.replace('/', '').toUpperCase();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
        
        const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${cleanSymbol}`, {
            signal: controller.signal
        });
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

export async function DELETE(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const clearAll = searchParams.get('all') === 'true';
        const silent = searchParams.get('silent') === 'true';
        const now = Date.now();

        if (clearAll) {
            // Fetch all in-progress smart trades with full details for execution
            const { rows } = await sql`
                SELECT id, symbol, side, qty, status, meta FROM orders 
                WHERE user_id = ${user.id} AND status IN ('FILLED', 'PENDING')
            `;
            
            const smartRows = rows.filter(r => {
                try {
                    const m = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
                    return m?.smartTrade === true;
                } catch { return false; }
            });

            if (smartRows.length === 0) {
                return NextResponse.json({ success: true, message: 'No smart trades to clear' });
            }

            // Fetch all prices in parallel with a local cache to avoid duplicates
            const symbolCache = new Map<string, Promise<number | undefined>>();
            const priceResults = await Promise.all(smartRows.map(async (row) => {
                if (!symbolCache.has(row.symbol)) {
                    symbolCache.set(row.symbol, fetchCurrentPrice(row.symbol));
                }
                const price = await symbolCache.get(row.symbol);
                return { 
                    id: row.id, 
                    price, 
                    meta: row.meta,
                    side: row.side,
                    qty: row.qty,
                    symbol: row.symbol
                };
            }));

            // Process in chunks of 5 to avoid overwhelming DB/API (P4.2 fix)
            const CHUNK_SIZE = 5;
            const outcomes: { id: number | string; success: boolean; error?: string }[] = [];
            
            for (let i = 0; i < priceResults.length; i += CHUNK_SIZE) {
                const chunk = priceResults.slice(i, i + CHUNK_SIZE);
                const chunkOutcomes = await Promise.all(chunk.map(async (res) => {
                    return closeSingleSmartTrade(user.id, res, now, silent);
                }));
                outcomes.push(...chunkOutcomes);
            }

            const successCount = outcomes.filter(o => o.success).length;
            
            return NextResponse.json({ 
                success: true, 
                message: `${successCount}/${smartRows.length} smart trades processed`,
                details: outcomes
            });
        }

        const clearHistory = searchParams.get('clearHistory') === 'true';
        if (clearHistory) {
            // Only delete CLOSED orders that are smart trades (matching GET filter)
            await sql`
                DELETE FROM orders 
                WHERE user_id = ${user.id} AND status = 'CLOSED' 
                AND (meta::jsonb->>'smartTrade')::boolean = true
            `;
            return NextResponse.json({ success: true, message: 'Smart trade history cleared' });
        }

        if (!id && !clearAll) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        
        // SearchParams handling done above
        
        if (id) {
            const { rows: tradeRows } = await sql`SELECT id, symbol, side, qty, status, meta FROM orders WHERE id = ${id} AND user_id = ${user.id}`;
            if (tradeRows.length === 0) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
            
            const trade = tradeRows[0];
            const currentPrice = await fetchCurrentPrice(trade.symbol);
            
            const result = await closeSingleSmartTrade(user.id, {
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                qty: trade.qty,
                price: currentPrice,
                meta: trade.meta
            }, now, silent);

            if (!result.success) {
                return NextResponse.json({ error: result.error || 'Failed' }, { status: 500 });
            }

            return NextResponse.json({ 
                success: true, 
                message: silent ? 'Order archived silently' : 'Order closed and position exited',
                exitPrice: currentPrice 
            });
        }
    } catch (error: unknown) {
        console.error('SmartTrade DELETE Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const payload = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
        }

        // Fetch existing trade to get current meta
        const { rows } = await sql`SELECT * FROM orders WHERE id = ${id}`;
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
        }

        const trade = rows[0];
        const existingMeta = typeof trade.meta === 'string' ? JSON.parse(trade.meta) : trade.meta;
        
        // Handle Flash Open - force immediate execution at market price
        if (payload.forceExecute === true) {
            const currentPrice = await fetchCurrentPrice(trade.symbol);
            if (!currentPrice) {
                return NextResponse.json({ error: 'Could not fetch current price' }, { status: 400 });
            }
            
            // Get user info
            const user = await getSessionUser(req);
            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Disable trailingBuy and update payload
            const updatedPayload = {
                ...existingMeta.payload,
                trailingBuy: false,
                buyPrice: currentPrice.toString()
            };
            
            const newMeta = {
                ...existingMeta,
                payload: updatedPayload,
                lastEditedAt: Date.now()
            };

            // Execute the trade immediately at market price
            try {
                if (trade.side === 'BUY') {
                    const qty = parseFloat(String(trade.qty));
                    const cost = qty * currentPrice;
                    await marketBuyByQuote(Number(user.id), trade.symbol, cost.toFixed(2));
                } else {
                    const qty = parseFloat(String(trade.qty)).toFixed(8).replace(/\.?0+$/, '');
                    await marketSellByQty(Number(user.id), trade.symbol, qty);
                }
            } catch (execError: unknown) {
                console.error('[FlashOpen] Execution failed:', execError);
                return NextResponse.json({ 
                    error: 'Flash open execution failed', 
                    details: execError instanceof Error ? execError.message : String(execError)
                }, { status: 500 });
            }

            // Update order status to FILLED
            await sql`
                UPDATE orders 
                SET status = 'FILLED', price = ${currentPrice}, meta = ${JSON.stringify(newMeta)}, updated_at = ${Date.now()}
                WHERE id = ${id}
            `;

            return NextResponse.json({ success: true, message: 'Flash open executed', price: currentPrice });
        }

        // Normal PUT - just update metadata
        const newMeta = {
            ...existingMeta,
            payload: {
                ...existingMeta.payload,
                ...payload // Only overwrite payload fields
            },
            lastEditedAt: Date.now()
        };

        await sql`
            UPDATE orders 
            SET meta = ${JSON.stringify(newMeta)}
            WHERE id = ${id}
        `;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('SmartTrade PUT Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        
        console.log('[API] SmartTrade Request:', {
            symbol: payload.symbol,
            amount: payload.amount,
            mode: payload.mode
        });

        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Read trading mode from cookie
        const cookieHeader = request.headers.get('cookie') || '';
        const modeCookie = cookieHeader.split(';').find(c => c.trim().startsWith('TRADING_MODE='));
        const tradingMode = modeCookie ? modeCookie.split('=')[1].trim() as 'test' | 'production' : 'test';

        console.log('[API] Trading Mode:', tradingMode);

        // Validate required fields
        if (!payload.symbol || !payload.amount || !payload.mode) {
            return NextResponse.json({ 
                error: 'Missing required fields', 
                required: ['symbol', 'amount', 'mode'] 
            }, { status: 400 });
        }

        const result = await handleSmartTrade({ ...payload, user_id: user.id }, tradingMode);
        
        console.log('[API] SmartTrade Result:', result);

        return NextResponse.json({ 
            success: true, 
            message: 'SmartTrade created successfully',
            result
        });

    } catch (error: unknown) {
        console.error('[API] SmartTrade Route FATAL Error:', error);
        
        // Extract as much info as possible
        let message = 'Unknown Error';
        let details = {};
        
        if (error instanceof Error) {
            message = error.message;
        }

        // Check if it's an Axios error from the MEXC API call inside handleSmartTrade
        if (axios.isAxiosError(error)) {
            details = error.response?.data || { message: error.message };
            console.error('[API] MEXC API Rejection Details:', details);
        }

        let status = 500;
        if (message.includes('Insufficient') || 
            message.includes('configured') || 
            message.includes('credentials') ||
            message.includes('Invalid') ||
            message.includes('Limit') ||
            message.includes('determined')) {
            status = 400;
        }

        return NextResponse.json({ 
            error: status === 400 ? 'Bad Request' : 'Internal Server Error', 
            message,
            details,
            stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        }, { status });
    }
}

interface CloseParams {
    id: number | string;
    symbol: string;
    side: string;
    qty: number | string;
    price?: number;
    meta: unknown;
}

/**
 * Helper to close a single smart trade: executing market order + DB update
 */
async function closeSingleSmartTrade(userId: string | number, res: CloseParams, now: number, silent: boolean) {
    try {
        const id = Number(res.id);
        const uid = Number(userId);

        // --- REAL EXECUTION (Skip if silent) ---
        if (!silent) {
            try {
                if (res.side === 'BUY') {
                    const sellQty = parseFloat(String(res.qty)).toFixed(8).replace(/\.?0+$/, '');
                    await marketSellByQty(uid, res.symbol, sellQty);
                } else if (res.side === 'SELL') {
                    const p = res.price || await getPrice(res.symbol);
                    if (p) {
                        const cost = parseFloat(String(res.qty)) * p;
                        await marketBuyByQuote(uid, res.symbol, cost.toFixed(6));
                    }
                }
            } catch (execError: unknown) {
                const msg = execError instanceof Error ? execError.message : String(execError);
                console.error(`[CloseTrade] Exchange execution failed for ${id} (${res.symbol}):`, msg);
            }
        }

        let existingMeta: Record<string, unknown> = {};
        try {
            existingMeta = typeof res.meta === 'string' ? JSON.parse(res.meta) : (res.meta || {});
        } catch { existingMeta = {}; }

        const updatedMeta = JSON.stringify({
            ...existingMeta,
            closedAt: now,
            exitPrice: res.price || undefined,
            exitReason: silent ? 'MANUAL_SILENT_EXIT' : 'MANUAL_PANIC_EXIT'
        });

        await sql`
            UPDATE orders 
            SET status = 'CLOSED', updated_at = ${now}, meta = ${updatedMeta}
            WHERE id = ${id} AND user_id = ${uid}
        `;
        return { id, success: true };
    } catch (err) {
        console.error(`[CloseTrade] DB update failed for ${res.id}:`, err);
        return { id: res.id, success: false, error: String(err) };
    }
}
