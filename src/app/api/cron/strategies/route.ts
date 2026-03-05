import { NextResponse } from "next/server";
import { runActiveStrategies } from "@/lib/strategy-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("[Cron] Triggering strategy execution...");

    // Run asynchronously to not timeout
    await runActiveStrategies();

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: unknown) {
    console.error("Strategy cron job failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 },
    );
  }
}
