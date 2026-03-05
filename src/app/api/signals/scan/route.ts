import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { SignalScanner } from "@/services/SignalScanner";

export const dynamic = "force-dynamic";

// Rate limit: max 1 scan per 30 seconds per user
// Rate limit map: userId -> lastScanTime
// NOTE: In a multi-instance or serverless environment (like Vercel), this Map is per-instance.
// For production consistency and memory safety, a distributed cache like Redis should be used.
const scanRateMap = new Map<number, number>();
const SCAN_COOLDOWN_MS = 30000;

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting per user
    const userId = Number(user.id);
    const now = Date.now(); // Define 'now' for consistent time checks
    const lastScan = scanRateMap.get(userId) || 0;
    if (lastScan && now - lastScan < SCAN_COOLDOWN_MS) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait 30 seconds between scans.",
          retryAfterMs: SCAN_COOLDOWN_MS - (now - lastScan),
        },
        { status: 429 },
      );
    }

    // --- Memory management: Cleanup old entries if map grows too large (P4.2 fix) ---
    if (scanRateMap.size > 1000) {
      const cleanupThreshold = now - 3600000; // 1 hour ago
      for (const [uid, ts] of scanRateMap.entries()) {
        if (ts < cleanupThreshold) scanRateMap.delete(uid);
      }
    }
    scanRateMap.set(userId, now); // Use 'now' for setting the current scan time

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

    const scanSymbols = await SignalScanner.resolveScanSymbols(userId, mode);
    const scanStartTime = Date.now();
    const allResults = await SignalScanner.runScan(scanSymbols);
    const scanDuration = Date.now() - scanStartTime;

    console.log(
      `[SignalScan] Completed scan for ${scanSymbols.length} symbols in ${scanDuration}ms`,
    );

    return NextResponse.json({
      scanned: scanSymbols.length,
      signals: allResults.filter((r) => r.inserted).length,
      results: allResults,
      timeframe: "1m",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SignalScan] Fatal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
