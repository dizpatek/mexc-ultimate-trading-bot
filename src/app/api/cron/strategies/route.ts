import { NextResponse } from "next/server";
import { runActiveStrategies } from "@/lib/strategy-engine";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    let userId = 1; // Varsayılan sistem kullanıcısı (Admin/Pilot)
    
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
    } else {
      userId = Number(user.id);
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

    // P1.1 SAFETY LOCK: Fetch the REAL active mode from database settings
    const { getSetting } = await import("@/lib/settings");
    const activeMode = (await getSetting("TRADING_MODE", userId)) || "test";

    if (requestedMode === "production" && activeMode === "test") {
      console.log(`[Cron/Strategies] 🛑 BLOCKING production request: User is currently in TEST mode.`);
      return NextResponse.json({ 
        success: true, 
        message: "Request ignored: Production execution blocked while app is in TEST mode.",
        timestamp: Date.now() 
      });
    }

    const tradingMode = requestedMode;

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
