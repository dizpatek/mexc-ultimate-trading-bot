import { sql } from '@vercel/postgres';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT'];
const DAYS = 30;
const INTERVAL = '1h'; // 1 hour interval

async function getKlines(symbol: string) {
    // MEXC limits kline requests, so we might need multiple calls or just get last 1000 candles
    // 30 days * 24 hours = 720 candles. Limit 1000 is enough.
    const url = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${INTERVAL}&limit=1000`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data as any[]; // [time, open, high, low, close, vol, ...]
    } catch (error) {
        console.error(`Failed to fetch klines for ${symbol}:`, error);
        return [];
    }
}

async function backfill() {
    console.log('🚀 Starting Price History Backfill...');

    if (!process.env.POSTGRES_URL) {
        console.error('❌ POSTGRES_URL environment variable is missing!');
        return;
    }

    let totalInserted = 0;

    for (const symbol of SYMBOLS) {
        console.log(`Processing ${symbol}...`);
        const klines = await getKlines(symbol);

        if (klines.length === 0) continue;

        // Calculate cutoff time
        const cutoff = Date.now() - (DAYS * 24 * 60 * 60 * 1000);

        // Filter klines within range
        const recentKlines = klines.filter((k: any[]) => k[0] >= cutoff);

        console.log(`  Found ${recentKlines.length} data points.`);

        for (const k of recentKlines) {
            const timestamp = k[0];
            const price = parseFloat(k[4]); // Close price

            try {
                await sql`
                    INSERT INTO asset_price_history (symbol, price, timestamp)
                    VALUES (${symbol}, ${price}, ${timestamp})
                    ON CONFLICT (symbol, timestamp) DO UPDATE SET price = ${price}
                `;
                totalInserted++;
            } catch (err) {
                console.error('  DB Insert Error:', err);
            }
        }
    }

    console.log(`\n✅ Backfill Complete! Inserted/Updated ${totalInserted} records.`);
}

backfill().catch(console.error);
