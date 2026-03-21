import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { SignalScanner } from "@/services/SignalScanner";

export const dynamic = "force-dynamic";

// Rate limit: max 1 scan per 30 seconds per user
// Rate limit map: userId -> lastScanTime
// NOTE: In a multi-instance or serverless environment, this Map is per-instance.
// For production consistency and memory safety, a distributed cache like Redis should be used.
const scanRateMap = new Map<number, number>();
const SCAN_COOLDOWN_MS = 25000;

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // P4.2: Intelligent Rate Limiting per user + per timeframe
    const { searchParams } = new URL(request.url);
    const targetTimeframe = searchParams.get("timeframe") || "1h";
    const userId = Number(user.id);
    const now = Date.now();
    
    const scanMapKey = `${userId}_${targetTimeframe}`;
    const lastScan = scanRateMap.get(userId) || 0; // Global limit for safety
    const lastTfScan = (scanRateMap as any).get(scanMapKey) || 0; // Specific TF limit

    // Allow scan if it's a DIFFERENT timeframe, even if global cooldown is active
    // But still enforce a minimal global cooldown of 3s to prevent spam
    if (lastScan && now - lastScan < 3000) {
       return NextResponse.json({ error: "Lütfen bekleyin...", retryAfterMs: 3000 - (now - lastScan)}, { status: 429 });
    }

    if (lastTfScan && now - lastTfScan < SCAN_COOLDOWN_MS) {
      return NextResponse.json(
        {
          error: "Bu periyot için tarama limiti doldu. Lütfen bekleyin.",
          retryAfterMs: SCAN_COOLDOWN_MS - (now - lastTfScan),
        },
        { status: 429 },
      );
    }

    // --- Memory management: Cleanup old entries if map grows too large (P4.2 fix) ---
    if (scanRateMap.size > 2000) {
      scanRateMap.clear();
    }
    scanRateMap.set(userId, now); 
    (scanRateMap as any).set(scanMapKey, now);

    // Get mode from cookies
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const mode =
      (cookieStore.get("TRADING_MODE")?.value as "test" | "production") ||
      "test";

    // P3.1: Key presence check for production mode
    if (mode === "production") {
      const { getMexcCredentials } = await import("@/lib/settings");
      const { apiKey, apiSecret } = await getMexcCredentials(
        userId,
        "production",
      );
      if (!apiKey || !apiSecret) {
        return NextResponse.json(
          {
            error:
              "API anahtarları eksik. Lütfen Ayarlar sayfasından MEXC API anahtarlarınızı tanımlayın.",
          },
          { status: 400 },
        );
      }
    }

    const { getBotConfig } = await import("@/lib/db");
    const botConfig = await getBotConfig(userId);
    const scanSymbols = await SignalScanner.resolveScanSymbols(userId, mode, botConfig || undefined);
    const scanStartTime = Date.now();
    const allResults = await SignalScanner.runScan(
      userId,
      scanSymbols,
      targetTimeframe,
      mode,
    );
    const scanDuration = Date.now() - scanStartTime;

    console.log(
      `[SignalScan] Completed scan for ${scanSymbols.length} symbols in ${scanDuration}ms (${targetTimeframe || "Default"})`,
    );

    return NextResponse.json({
      scanned: scanSymbols.length,
      signals: allResults.filter((r) => r.inserted).length,
      results: allResults,
      timeframe: targetTimeframe || "1h",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SignalScan] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
