import { NextResponse } from 'next/server';
import { MatrixV5Engine } from '@/lib/matrix-v5-engine';
import { fetchKlines } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';
import { createStrategySignal } from '@/lib/db';
import { ensureTablesExist } from '@/lib/db-init';
import { sql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

const engine = new MatrixV5Engine();

const SCAN_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'BNBUSDT'];
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// Rate limit: max 1 scan per 30 seconds per user
const scanRateMap = new Map<number, number>();
const SCAN_COOLDOWN_MS = 30_000;

interface ScanResult {
    symbol: string;
    signalType: string;
    price: number;
    detail: string;
    aiScore: number;
    inserted: boolean;
}

// --- Service Layer ---

async function hasRecentSignal(symbol: string, signalType: string): Promise<boolean> {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    const { rows } = await sql`
        SELECT 1 FROM strategy_signals 
        WHERE symbol = ${symbol} AND signal_type = ${signalType} AND timestamp > ${cutoff}
        LIMIT 1
    `;
    return rows.length > 0;
}

async function insertIfNew(
    symbol: string, signalType: string, price: number, 
    volume: number | undefined, detail: Record<string, unknown>
): Promise<boolean> {
    const isDuplicate = await hasRecentSignal(symbol, signalType);
    if (isDuplicate) return false;
    
    await createStrategySignal({
        symbol,
        signal_type: signalType,
        price,
        volume,
        timestamp: Date.now(),
        executed: false,
        execution_result: detail
    });
    return true;
}

interface EngineResult {
    aiScore: number;
    systemDecision: string;
    prediction?: { text?: string };
    trend: string;
    whaleStatus: string;
    whaleSignalText?: string;
    smc: { bos: boolean; choch: boolean; swingTrend: string };
    inPremium: boolean;
    inDiscount: boolean;
    f4EarlyBuy: boolean;
    f4ConfirmedBuy: boolean;
    f4EarlySell: boolean;
    f4ConfirmedSell: boolean;
    slope: number;
    acceleration: number;
}

function evaluateSignals(
    _symbol: string, result: EngineResult
): { signalType: string; detail: Record<string, unknown> }[] {
    const signals: { signalType: string; detail: Record<string, unknown> }[] = [];

    // 1. High AI Score with decision
    if (result.aiScore >= 75 && result.systemDecision !== 'WAIT') {
        const signalType = result.systemDecision === 'GO_LONG' ? 'BUY' : 
                           result.systemDecision === 'GO_SHORT' ? 'SELL' : 'AI_ANALYSIS';
        signals.push({
            signalType,
            detail: {
                detail: `AI Skoru: ${result.aiScore} | ${result.prediction?.text || result.systemDecision} | Trend: ${result.trend}`,
                aiScore: result.aiScore,
                trend: result.trend
            }
        });
    }

    // 2. Whale Detection
    if (result.whaleStatus && result.whaleStatus !== 'NEUTRAL') {
        signals.push({
            signalType: 'WHALE',
            detail: { detail: `🐋 ${result.whaleSignalText || result.whaleStatus}`, whaleStatus: result.whaleStatus }
        });
    }

    // 3. Structure Break (BOS / CHoCH)
    if (result.smc?.bos || result.smc?.choch) {
        const structureType = result.smc.bos ? 'BOS' : 'CHoCH';
        signals.push({
            signalType: structureType,
            detail: { 
                detail: `📐 ${structureType}: ${result.smc.swingTrend} | Premium: ${result.inPremium ? 'EVET' : 'HAYIR'} | Discount: ${result.inDiscount ? 'EVET' : 'HAYIR'}`,
                smc: { bos: result.smc.bos, choch: result.smc.choch, swingTrend: result.smc.swingTrend }
            }
        });
    }

    // 4. F4 Early/Confirmed Buy
    if (result.f4EarlyBuy || result.f4ConfirmedBuy) {
        const type = result.f4ConfirmedBuy ? 'F4_CONFIRMED_BUY' : 'F4_EARLY_BUY';
        signals.push({
            signalType: type,
            detail: { detail: `⚡ ${type.replace(/_/g, ' ')}: Slope=${result.slope?.toFixed(4)} | Accel=${result.acceleration?.toFixed(4)}` }
        });
    }

    // 5. F4 Early/Confirmed Sell
    if (result.f4EarlySell || result.f4ConfirmedSell) {
        const type = result.f4ConfirmedSell ? 'F4_CONFIRMED_SELL' : 'F4_EARLY_SELL';
        signals.push({
            signalType: type,
            detail: { detail: `⚡ ${type.replace(/_/g, ' ')}: Slope=${result.slope?.toFixed(4)} | Accel=${result.acceleration?.toFixed(4)}` }
        });
    }

    return signals;
}

async function scanSymbol(symbol: string): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const interval = '1m';
    
    const klines = await fetchKlines(symbol, interval, 200);
    if (!klines || klines.length < 50) return results;

    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);

    const result = engine.analyze(closes, highs, lows, volumes, interval, 'normal') as unknown as EngineResult;
    const currentPrice = closes[closes.length - 1];
    const volume = volumes[volumes.length - 1];

    const candidates = evaluateSignals(symbol, result);

    for (const candidate of candidates) {
        const inserted = await insertIfNew(symbol, candidate.signalType, currentPrice, volume, candidate.detail);
        results.push({
            symbol,
            signalType: candidate.signalType,
            price: currentPrice,
            detail: inserted ? String(candidate.detail.detail || candidate.signalType) : `${candidate.signalType} (deduplicated)`,
            aiScore: result.aiScore,
            inserted
        });
    }

    return results;
}

// --- Route Handler ---

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limiting per user
        const userId = Number(user.id);
        const lastScan = scanRateMap.get(userId) || 0;
        if (Date.now() - lastScan < SCAN_COOLDOWN_MS) {
            return NextResponse.json({ error: 'Rate limited', retryAfterMs: SCAN_COOLDOWN_MS - (Date.now() - lastScan) }, { status: 429 });
        }
        scanRateMap.set(userId, Date.now());

        await ensureTablesExist();

        // Scan in batches of 2 to prevent DB connection exhaustion
        const allResults: ScanResult[] = [];
        const batchSize = 2;

        for (let i = 0; i < SCAN_SYMBOLS.length; i += batchSize) {
            const batch = SCAN_SYMBOLS.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(symbol => scanSymbol(symbol).catch(err => {
                    console.error(`[SignalScan] Error scanning ${symbol}:`, err);
                    return [] as ScanResult[];
                }))
            );
            allResults.push(...batchResults.flat());
        }

        return NextResponse.json({ 
            scanned: SCAN_SYMBOLS.length,
            signals: allResults.filter(r => r.inserted).length,
            results: allResults
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[SignalScan] Fatal error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
