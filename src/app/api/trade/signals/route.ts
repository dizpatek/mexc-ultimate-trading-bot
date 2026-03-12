import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql } from "@/lib/postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/trade/signals
 * Returns recent pilot strategy signals.
 * Used by MatrixHorizon.tsx to poll for new BUY/SELL signals and show
 * the auto-approve toast when Auto Pilot is ON.
 * (Note: strategy_signals table is global and not user-segmented by design.)
 *
 * Query params:
 *   limit  - max number of signals to return (default: 5)
 *   since  - only return signals after this timestamp (ms)
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 50);
    
    // Get mode from query or cookies
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const tradingMode = searchParams.get("tradingMode") || cookieStore.get("TRADING_MODE")?.value || "test";

    const since = searchParams.get("since")
      ? parseInt(searchParams.get("since")!)
      : Date.now() - 60_000; // default: last 60s

    // Query strategy_signals table – symbol-based pilot signals have no strategy_id
    const { rows } = await sql`
      SELECT
        id,
        strategy_id,
        symbol,
        signal_type,
        price,
        timestamp,
        executed,
        execution_result,
        trading_mode
      FROM strategy_signals
      WHERE
        timestamp > ${since}
        AND signal_type IN ('BUY', 'SELL')
        AND executed = false
        AND (trading_mode = ${tradingMode} OR trading_mode IS NULL)
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(rows);
  } catch (error: unknown) {
    console.error("[/api/trade/signals] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
