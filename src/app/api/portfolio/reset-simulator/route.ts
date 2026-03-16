import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql, pool } from "@/lib/postgres";
import {
  invalidateSimulator,
  INITIAL_PORTFOLIO,
  resetSimulatorDatabase,
} from "@/lib/trading-simulator";
import { DEFAULT_TIMEFRAME_SETTINGS } from "@/lib/constants/bot-defaults";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// P4.3: Global lock to prevent concurrent reset operations for the same user
const resettingUsers = new Set<number>();

export async function POST(request: Request) {
  let userId: number | undefined;
  try {
    const user = await getSessionUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    userId = user.id;

    if (resettingUsers.has(userId)) {
      console.warn(
        `[Reset] Reset already in progress for User ID: ${userId}. Blocking concurrent request.`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "A simulator reset is already in progress. Please wait.",
        },
        { status: 429 },
      );
    }

    resettingUsers.add(userId);

    console.log(`[Reset] Initiating wipe for User ID: ${user.id}`);
    
    // P4.4 & P3.1: invalidate memory state BEFORE starting destructive DB operations
    invalidateSimulator(user.id);

    // Call the newly extracted database operation
    await resetSimulatorDatabase(user.id);

    // 4. Update memory and persistence (Migration Cleanup)
    await setSetting("SIMULATED_BALANCES", "", user.id);
    await setSetting("SIM_V2_MIGRATED", "", user.id);
    await setSetting("SIM_V3_MIGRATED", "", user.id);

    // P3.1 & P4.4: Final invalidation at the END of the process to wipe any instance
    // that might have been created during the asynchronous DB wipe.
    invalidateSimulator(user.id);

    console.log(
      `[Reset] Wipe complete. User ${user.id} has ~$110k portfolio reset.`,
    );

    const assetList = INITIAL_PORTFOLIO.map((a: { s: string }) => `${a.s}`).join(", ");

    // DEFAULT_TIMEFRAME_SETTINGS kullanılabilir: örn. log veya response için
    void DEFAULT_TIMEFRAME_SETTINGS;

    return NextResponse.json({
      success: true,
      message: `Simulator reset successful. Test account re-initialized with ${INITIAL_PORTFOLIO.length} assets: ${assetList}. Total balance: $110,000 USDT.`,
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
  } finally {
    if (userId !== undefined) {
      resettingUsers.delete(userId);
    }
  }
}
