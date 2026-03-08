import { NextResponse } from "next/server";
import { runActiveStrategies } from "@/lib/strategy-engine";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(user.id);

    const { searchParams } = new URL(request.url);
    const immediate = searchParams.get("immediate") === "true";

    console.log(`[Cron] Triggering strategy execution... (immediate: ${immediate}, user: ${userId})`);

    // Run asynchronously to not timeout
    await runActiveStrategies(immediate, userId);

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
