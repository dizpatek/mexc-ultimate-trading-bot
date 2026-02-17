import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { handleSmartTrade } from '@/lib/smart-trade';
import { sql } from '@vercel/postgres';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch orders
        const { rows } = await sql`
            SELECT id, symbol, side, type, qty, price, status, created_at, meta 
            FROM orders 
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

        if (clearAll) {
            // Delete all smart trades for this user? 
            // Since we don't have perfect user isolation in the query above yet, 
            // let's be careful. For now, we filter by meta.
            await sql`
                DELETE FROM orders 
                WHERE meta::jsonb->>'smartTrade' = 'true'
            `;
            return NextResponse.json({ success: true, message: 'All smart trades cleared' });
        }

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await sql`DELETE FROM orders WHERE id = ${id}`;
        
        return NextResponse.json({ success: true, message: 'Order deleted' });
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

        const result = await handleSmartTrade(payload, tradingMode);
        
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
