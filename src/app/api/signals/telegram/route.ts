import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TelegramSignal {
    timestamp: string;
    symbol: string | null;
    direction: 'LONG' | 'SHORT';
    entry: number | null;
    targets: number[];
    stop_loss: number | null;
    exchange: string;
    pair_type: 'SPOT' | 'FUTURES';
    raw_message: string;
}

// In-memory storage for signals (in production, use database)
let signals: TelegramSignal[] = [];

export async function GET() {
    try {
        return NextResponse.json({
            success: true,
            count: signals.length,
            signals: signals.slice(-50) // Return last 50 signals
        });
    } catch (error) {
        console.error('Error fetching signals:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch signals' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const signal: TelegramSignal = await request.json();

        // Validate signal
        if (!signal.symbol || !signal.entry) {
            return NextResponse.json(
                { success: false, error: 'Invalid signal data' },
                { status: 400 }
            );
        }

        // Add timestamp if not present
        if (!signal.timestamp) {
            signal.timestamp = new Date().toISOString();
        }

        // Store signal
        signals.push(signal);

        // Keep only last 1000 signals in memory
        if (signals.length > 1000) {
            signals = signals.slice(-1000);
        }

        console.log('New signal received:', {
            symbol: signal.symbol,
            entry: signal.entry,
            targets: signal.targets
        });

        return NextResponse.json({
            success: true,
            signal
        });
    } catch (error) {
        console.error('Error processing signal:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process signal' },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        signals = [];
        return NextResponse.json({
            success: true,
            message: 'All signals cleared'
        });
    } catch (error) {
        console.error('Error clearing signals:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to clear signals' },
            { status: 500 }
        );
    }
}
