import { NextResponse } from "next/server";
import {
  getAccountInfo,
  type TradingMode,
} from "@/lib/mexc-wrapper";
import { getMexcCredentials } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth-utils";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get mode from cookies (Next.js 15+ await cookies())
    // P1.0 SAFETY SYNC: Do not rely solely on cookies. Check the Supreme Truth (DB).
    const { getSetting } = await import("@/lib/settings");
    const activeDbMode = (await getSetting("TRADING_MODE", user.id)) || "test";

    // Get mode from cookies (Next.js 15+ await cookies())
    const cookieStore = await cookies();
    const cookieMode =
      (cookieStore.get("TRADING_MODE")?.value as TradingMode) || "test";
    
    // If they differ, DB wins for safety
    const mode = activeDbMode === "test" ? "test" : (cookieMode || "production");

    if (mode === "production") {
      const { apiKey, apiSecret } = await getMexcCredentials(user.id, mode);
      if (!apiKey || !apiSecret) {
        return NextResponse.json(
          {
            error:
              "Production mode requires API keys. Please configure them in Settings.",
          },
          { status: 400 },
        );
      }
    }


    // ── Step 1: Get account info (fast — test mode reads from DB)
    const accountInfo = await getAccountInfo(user.id, mode);

    if (!accountInfo || !accountInfo.balances) {
      console.warn(`[Holdings] No balances found for user ${user.id} in ${mode} mode.`);
      return NextResponse.json([]);
    }

    const activeBalances = (accountInfo.balances || []).filter(
      (b: { free: string; locked: string }) =>
        parseFloat(b.free) + parseFloat(b.locked) > 0,
    );

    console.log(`[Holdings] User ${user.id} (${mode}) has ${activeBalances.length} active balances.`);

    // ── Step 2: Build symbol list (exclude stablecoins — they are always $1)
    const nonStable = activeBalances.filter(
      (b: { asset: string }) => b.asset !== "USDT" && b.asset !== "USDC"
    );
    const symbolsNeeded = nonStable.map((b: { asset: string }) => `${b.asset}USDT`);

    // ── Step 3: Fetch ONLY the symbols we need — tiny payload, very fast
    let priceMap: Map<string, number> = new Map();
    let changeMap: Map<string, number> = new Map();

    if (symbolsNeeded.length > 0) {
      try {
        // Use /ticker/price for just prices (smallest payload)
        const priceUrl = `https://api.mexc.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbolsNeeded))}`;
        const priceRes = await fetch(priceUrl, {
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });
        if (priceRes.ok) {
          const priceData: Array<{ symbol: string; price: string }> = await priceRes.json();
          if (Array.isArray(priceData)) {
            priceData.forEach(item => priceMap.set(item.symbol, parseFloat(item.price)));
          }
        }
      } catch (e) {
        console.warn("[Holdings] Price fetch failed, using zeros:", e);
      }
    }

    let totalValue = 0;
    const holdingsData = activeBalances.map((balance: { asset: string; free: string; locked: string }) => {
      const free = parseFloat(balance.free);
      const locked = parseFloat(balance.locked);
      const totalQty = free + locked;
      const symbol = balance.asset;
      const pair = `${symbol}USDT`;

      let currentPrice = 0;
      let change24h = 0;

      if (symbol === "USDT" || symbol === "USDC") {
        currentPrice = 1;
        change24h = 0;
      } else {
        currentPrice = priceMap.get(pair) || 0;
        change24h = changeMap.get(pair) || 0;
      }

      const value = totalQty * currentPrice;
      totalValue += value;

      return {
        id: symbol,
        symbol,
        name: symbol,
        holding: totalQty,
        price: currentPrice,
        value,
        change24h,
        allocation: 0,
      };
    });

    // Calculate allocation
    const finalHoldings = holdingsData.map((h) => ({
      ...h,
      allocation: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
    }));

    // Sort by value DESC
    finalHoldings.sort((a, b) => b.value - a.value);

    return NextResponse.json(finalHoldings);
  } catch (error: any) {
    console.error("[Holdings API Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch holdings", details: error.message, stack: error.stack },
      { status: 500 },
    );
  }
}
