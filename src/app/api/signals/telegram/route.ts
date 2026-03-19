import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface TelegramSignal {
  id?: number;
  timestamp: string | number;
  symbol: string | null;
  direction: "LONG" | "SHORT";
  entry: number | null;
  targets: number[] | string;
  stop_loss: number | null;
  exchange: string;
  pair_type: "SPOT" | "FUTURES";
  raw_message: string;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rows } = await sql`
      SELECT * FROM telegram_signals 
      WHERE user_id = ${user.id} 
      ORDER BY timestamp DESC 
      LIMIT 100
    `;

    return NextResponse.json({
      success: true,
      count: rows.length,
      signals: rows.map(r => ({ ...r, targets: typeof r.targets === 'string' ? JSON.parse(r.targets) : r.targets })),
    });
  } catch (error) {
    console.error("Error fetching signals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch signals" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const signal: TelegramSignal = await request.json();

    if (!signal.symbol || !signal.entry) {
      return NextResponse.json(
        { success: false, error: "Invalid signal data" },
        { status: 400 },
      );
    }

    const timestamp = signal.timestamp ? (typeof signal.timestamp === 'string' ? new Date(signal.timestamp).getTime() : signal.timestamp) : Date.now();
    const targetsJson = JSON.stringify(signal.targets || []);

    await sql`
      INSERT INTO telegram_signals (
        user_id, symbol, direction, entry, targets, stop_loss, exchange, pair_type, raw_message, timestamp
      ) VALUES (
        ${user.id}, ${signal.symbol}, ${signal.direction}, ${signal.entry}, ${targetsJson}, 
        ${signal.stop_loss}, ${signal.exchange}, ${signal.pair_type}, ${signal.raw_message}, ${timestamp}
      )
    `;

    console.log(`[TelegramSignal] New signal for user ${user.id}: ${signal.symbol}`);

    return NextResponse.json({
      success: true,
      signal: { ...signal, timestamp }
    });
  } catch (error) {
    console.error("Error processing signal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process signal" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await sql`DELETE FROM telegram_signals WHERE user_id = ${user.id}`;

    return NextResponse.json({
      success: true,
      message: "Senin tüm Telegram sinyallerin temizlendi.",
    });
  } catch (error) {
    console.error("Error clearing signals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear signals" },
      { status: 500 },
    );
  }
}
