import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { handleSmartTrade } from '@/lib/smart-trade';
import { sql } from '@vercel/postgres';
import axios from 'axios';
import { getPrice, marketBuyByQuote, marketSellByQty, type TradingMode } from '@/lib/mexc-wrapper';
import { getMexcCredentials } from '@/lib/settings';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
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
            // meta is TEXT column — we must read, parse, merge in JS, write back
            const { rows } = await sql`
                SELECT id, meta FROM orders 
                WHERE user_id = ${user.id} AND status IN ('FILLED', 'PENDING')
            `;
            
            const smartRows = rows.filter(r => {
                try {
                    const m = typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta;
                    return m?.smartTrade === true;
                } catch { return false; }
            });

            for (const row of smartRows) {
                const existingMeta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
                const updatedMeta = JSON.stringify({
                    ...existingMeta,
                    closedAt: now,
                    exitReason: silent ? 'MANUAL_SILENT_FLUSH_ALL' : 'MANUAL_FLUSH_ALL'
                });
                await sql`
                    UPDATE orders 
                    SET status = 'CLOSED', updated_at = ${now}, meta = ${updatedMeta}
                    WHERE id = ${row.id}
                `;
            }
            return NextResponse.json({ success: true, message: `${smartRows.length} smart trades moved to history` });
        }

        if (!id && !clearAll) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        
        // --- REAL EXECUTION PANIC EXIT (Skip if silent) ---
        if (id && !silent) {
            const { rows: tradeRows } = await sql`SELECT user_id, symbol, side, qty, status, meta FROM orders WHERE id = ${id} AND user_id = ${user.id}`;
            if (tradeRows.length > 0) {
                const trade = tradeRows[0];
                if (trade.status === 'FILLED' || (trade.status === 'PENDING' && trade.side === 'SELL')) {
                    console.log(`[PanicExit] Executing real exchange close for trade ${id} (${trade.symbol})`);
                    try {
                        if (trade.side === 'BUY') {
                            const sellQty = parseFloat(String(trade.qty)).toFixed(8).replace(/\.?0+$/, '');
                            await marketSellByQty(user.id, trade.symbol, sellQty);
                        } else {
                            const currentP = await getPrice(trade.symbol);
                            const cost = parseFloat(String(trade.qty)) * currentP;
                            await marketBuyByQuote(user.id, trade.symbol, cost.toFixed(6));
                        }
                    } catch (execError) {
                        console.error(`[PanicExit] Exchange execution failed for ${id}:`, execError);
                    }
                }
            }
        }
        
        if (id) {
            // Update meta as TEXT (parse → merge → stringify)
            const { rows: currentRows } = await sql`SELECT meta FROM orders WHERE id = ${id}`;
            let existingMeta = {};
            if (currentRows.length > 0) {
                try {
                    existingMeta = typeof currentRows[0].meta === 'string' ? JSON.parse(currentRows[0].meta) : (currentRows[0].meta || {});
                } catch { existingMeta = {}; }
            }
            const updatedMeta = JSON.stringify({
                ...existingMeta,
                closedAt: now,
                exitReason: silent ? 'MANUAL_SILENT_CLOSE' : 'MANUAL_PANIC_EXIT'
            });

            await sql`
                UPDATE orders 
                SET status = 'CLOSED', updated_at = ${now}, meta = ${updatedMeta}
                WHERE id = ${id} AND user_id = ${user.id}
            `;
            
            return NextResponse.json({ success: true, message: silent ? 'Order archived silently' : 'Order closed and position exited' });
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
        const { rows } = await sql`SELECT meta FROM orders WHERE id = ${id}`;
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
        }

        const existingMeta = typeof rows[0].meta === 'string' ? JSON.parse(rows[0].meta) : rows[0].meta;
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

        return NextResponse.json({ 
            error: 'Internal Server Error', 
            message,
            details,
            stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
        }, { status: 500 });
    }
}
