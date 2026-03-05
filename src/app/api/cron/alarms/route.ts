import { NextResponse } from "next/server";
import { checkAlarms } from "@/lib/alarm-engine";
import { ensureTablesExist } from "@/lib/db-init";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Basic authorization for cron job (check secret)
    const { searchParams } = new URL(req.url);
    // Verify cron secret if provided
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const secret = searchParams.get("secret");
      if (secret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Ensure tables exist before running engine
    await ensureTablesExist();

    console.log("[Cron] Triggering alarm check...");
    await checkAlarms();

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
