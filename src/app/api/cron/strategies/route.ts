import { NextResponse } from "next/server";
import { runActiveStrategies } from "@/lib/strategy-engine";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Güvenlik: Northflank vb. Cron Job servisleri için bypass izni
    const authHeader = request.headers.get("authorization");
    const isDev = process.env.NODE_ENV !== "production";
    const cronSecret = process.env.CRON_SECRET || (isDev ? "dev-secret" : null);
    
    const user = await getSessionUser(request);
    
    // Eğer oturum yoksa (Cron), mutlaka yetki anahtarı sor
    if (!user || !user.id) {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[Cron/Strategies] Unauthorized execution attempt blocked.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const immediate = searchParams.get("immediate") === "true";
    const queryMode = searchParams.get("tradingMode");

    // Parametre veya cookie okuması, fallback için ortam değişkeni desteği
    const cookieHeader = request.headers.get("cookie") || "";
    const modeCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("TRADING_MODE="));
      
    const envFallback = process.env.DEFAULT_TRADING_MODE as "test" | "production" | undefined;
    const requestedMode = (queryMode as "test" | "production") || (modeCookie
      ? (modeCookie.split("=")[1].trim() as "test" | "production")
      : envFallback || "test");

    const { getAllUserIds } = await import("@/lib/db");
    const userIds = await getAllUserIds();
    
    console.log(`[Cron] Triggering PARALLEL strategy execution for ${userIds.length} users... (immediate: ${immediate}, mode: ${requestedMode})`);

    // Run all users in parallel using Promise.allSettled to ensure isolation
    const results = await Promise.allSettled(userIds.map(async (userId) => {
      try {
        const { getSetting } = await import("@/lib/settings");
        const activeMode = (await getSetting("TRADING_MODE", userId)) || "test";

        if (requestedMode !== activeMode) {
          console.log(`[Cron/Strategies] 🛑 User ${userId}: mod uyuşmazlığı (istek: ${requestedMode}, kullanıcı: ${activeMode}). Atlanıyor.`);
          return { userId, status: "SKIPPED", reason: `Mode mismatch: requested=${requestedMode}, active=${activeMode}` };
        }

        console.log(`[Cron] ⚡ Starting private cycle for user: ${userId}`);
        await runActiveStrategies(immediate, userId, requestedMode);
        return { userId, status: "SUCCESS" };
      } catch (err) {
        console.error(`[Cron/Strategies] ❌ Private cycle FAILED for user ${userId}:`, err);
        throw { userId, status: "ERROR", error: String(err) };
      }
    }));

    // ProcessSettled results for the response
    const finalResults = results.map(r => r.status === "fulfilled" ? r.value : r.reason);

    return NextResponse.json({ 
      success: true, 
      processed: userIds.length,
      results: finalResults,
      timestamp: Date.now() 
    });
  } catch (error: unknown) {
    console.error("Strategy cron job failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 },
    );
  }
}
