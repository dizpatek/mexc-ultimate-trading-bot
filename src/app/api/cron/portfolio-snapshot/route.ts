import { NextResponse } from "next/server";
import { createPortfolioSnapshot } from "@/lib/db";
import { getAccountInfo, getPrice } from "@/lib/mexc-wrapper";

export const dynamic = "force-dynamic";

/**
 * Portfolio Snapshot Cron Job
 * This endpoint is called by Vercel Cron to create portfolio snapshots
 * Configured in vercel.json
 */

export async function GET(request: Request) {
  try {
    // Verify cron secret (security)
    const authHeader = request.headers.get("authorization");
    // Use 'dev-secret' ONLY in non-production environments for local testing
    const isDev = process.env.NODE_ENV !== "production";
    const cronSecret = process.env.CRON_SECRET || (isDev ? "dev-secret" : null);

    if (!cronSecret) {
      console.error("[Cron] CRON_SECRET is not configured. Aborting snapshot.");
      return NextResponse.json(
        { error: "Configuration Error" },
        { status: 500 },
      );
    }

    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting portfolio snapshot for all users...");

    const { getAllUserIds } = await import("@/lib/db");
    const userIds = await getAllUserIds();
    
    console.log(`[Cron] Starting PARALLEL portfolio snapshot for ${userIds.length} users...`);

    const results = await Promise.allSettled(userIds.map(async (userId) => {
      try {
        console.log(`[Cron] ⚡ Snapshot starting for user: ${userId}`);
        
        // Get account info for this specific user
        const accountInfo = await getAccountInfo(userId);
        const activeBalances = (accountInfo.balances || []).filter(
          (b: { free: string; locked: string }) =>
            parseFloat(b.free) + parseFloat(b.locked) > 0,
        );

        let totalValue = 0;
        let totalAssets = 0;
        const balancesDetail = [];

        // Calculate total value
        for (const balance of activeBalances) {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          const totalQty = free + locked;
          const symbol = balance.asset;

          let price = 0;
          const pair = `${symbol}USDT`;

          if (symbol === "USDT" || symbol === "USDC") {
            price = 1;
          } else {
            try {
              price = await getPrice(pair);
            } catch {
              console.warn(`[Cron] Could not get price for ${pair} (User: ${userId})`);
            }
          }

          const value = totalQty * price;

          if (value > 0.01) {
            totalValue += value;
            totalAssets++;

            balancesDetail.push({
              asset: symbol,
              free,
              locked,
              price,
              value,
              timestamp: Date.now(),
            });
          }
        }

        // Create snapshot for this user
        const snapshotId = await createPortfolioSnapshot(
          userId,
          totalValue,
          totalAssets,
          balancesDetail,
        );

        console.log(`[Cron] ✅ Snapshot for user ${userId} completed: $${totalValue.toFixed(2)}`);
        return { userId, status: "SUCCESS", snapshotId, value: totalValue };
      } catch (err) {
        console.error(`[Cron] ❌ Snapshot FAILED for user ${userId}:`, err);
        throw { userId, status: "ERROR", error: String(err) };
      }
    }));

    // Process result objects for response
    const finalResults = results.map(r => r.status === "fulfilled" ? r.value : r.reason);

    return NextResponse.json({
      success: true,
      processed: userIds.length,
      results: finalResults,
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    console.error("[Cron] Error creating portfolio snapshot:", error);
    return NextResponse.json(
      {
        error: "Failed to create snapshot",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
