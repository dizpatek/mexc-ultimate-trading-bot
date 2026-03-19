import { NextResponse } from "next/server";
import { checkTrailingStops } from "@/lib/trailing-stop";
import { monitorSmartTrades } from "@/lib/smart-trade-monitor";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const isDev = process.env.NODE_ENV !== "production";
    const cronSecret = process.env.CRON_SECRET || (isDev ? "dev-secret" : null);
    const { searchParams } = new URL(request.url);
    const queryMode = searchParams.get("tradingMode");
    const querySecret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");

    const user = await getSessionUser(request);
    
    // Auth bypass for direct browser access or cron jobs using secret
    if (!user) {
      const isAuthorizedBySecret = (cronSecret && (
        querySecret === cronSecret || 
        authHeader === `Bearer ${cronSecret}`
      ));

      if (!isAuthorizedBySecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Determine requested mode
    const envFallback = process.env.DEFAULT_TRADING_MODE as "test" | "production" | undefined;
    const requestedMode = (queryMode as "test" | "production") || envFallback || "test";

    console.log(`[Cron/TrailingStop] Starting monitoring for ALL users in "${requestedMode}" mode...`);

    // 1. Ensure table exists (Lazy initialization)
    await sql`
            CREATE TABLE IF NOT EXISTS trailing_stops (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                symbol TEXT NOT NULL,
                quantity DECIMAL NOT NULL,
                entry_price DECIMAL NOT NULL,
                highest_price DECIMAL NOT NULL,
                callback_rate DECIMAL NOT NULL,
                activation_price DECIMAL,
                status TEXT DEFAULT 'ACTIVE',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;

    // 2. Execute monitors - monitorSmartTrades handles all users for the specific mode internally
    await checkTrailingStops();
    await monitorSmartTrades(requestedMode);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: unknown) {
    console.error("Trailing Stop Cron Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
