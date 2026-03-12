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
    const queryMode = searchParams.get("tradingMode");

    // Read trading mode from URL, then cookie, fallback to test
    const cookieHeader = request.headers.get("cookie") || "";
    const modeCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("TRADING_MODE="));
    const tradingMode = (queryMode as "test" | "production") || (modeCookie
      ? (modeCookie.split("=")[1].trim() as "test" | "production")
      : "test");

    console.log(`[Cron] Triggering strategy execution... (immediate: ${immediate}, user: ${userId}, mode: ${tradingMode})`);

    // Run asynchronously to not timeout
    await runActiveStrategies(immediate, userId, tradingMode);

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
