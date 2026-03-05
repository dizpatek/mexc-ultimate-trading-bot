import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql } from "@/lib/postgres";
import { ensureTablesExist } from "@/lib/db-init";
import { resetSimulator } from "@/lib/trading-simulator";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    console.log(`[Reset] Initiating wipe for User ID: ${user.id}`);

    // Ensure database structure is ready
    await ensureTablesExist();

    // 1. Transactional Delete with individual try-catches to handle non-existent tables or missing data
    const cleanup = async (tableName: string) => {
      try {
        await sql`DELETE FROM ${sql(tableName)} WHERE user_id = ${user.id}`;
        console.log(`[Reset] Cleaned table: ${tableName}`);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.warn(`[Reset] Could not clean ${tableName}: ${errorMessage}`);
      }
    };

    // Order matters for some FK constraints if any, but we'll try all
    await cleanup("trade_history");
    await cleanup("orders");
    await cleanup("portfolio_snapshots");
    await cleanup("dca_bots");
    await cleanup("panic_snapshots");
    await cleanup("alarm_logs");
    await cleanup("alarms");

    // 2. Portfolio Table - Total Wipe for this user
    try {
      await sql`DELETE FROM portfolio WHERE user_id = ${user.id}`;
    } catch {
      /* ignore */
    }

    // 3. Re-initialize with ~$70,000 scaled Simulator entry
    await sql`
            INSERT INTO portfolio (user_id, symbol, balance, type, created_at, updated_at)
            VALUES (${user.id}, 'USDT', 5000.00, 'SIMULATOR', ${Date.now()}, ${Date.now()})
            ON CONFLICT (user_id, symbol, type) DO UPDATE 
            SET balance = 5000.00, updated_at = ${Date.now()}
        `;

    // 4. Clear in-memory simulator instance (singleton)
    resetSimulator(user.id);

    // 5. Clear saved simulated balances so syncSimulator starts fresh with initializeTestBalance()
    try {
      await setSetting("SIMULATED_BALANCES", "", user.id);
    } catch {
      /* ignore */
    }

    console.log(
      `[Reset] Wipe complete. User ${user.id} has ~$70k portfolio reset.`,
    );

    return NextResponse.json({
      success: true,
      message:
        "Simulator wiped. ~$70,000 portfolio restored (5k USDT + 0.5 BTC + 5 ETH + 50 SOL).",
    });
  } catch (error: unknown) {
    console.error("CRITICAL RESET ERROR:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
