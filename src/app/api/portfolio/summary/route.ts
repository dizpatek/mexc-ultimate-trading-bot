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

    // Force reading from cookie (Next.js 15+)
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


    // ── Step 1: Get account info
    const accountInfo = await getAccountInfo(user.id, mode);

    const activeBalances = (accountInfo.balances || []).filter(
      (b: { free: string; locked: string }) =>
        parseFloat(b.free) + parseFloat(b.locked) > 0,
    );

    // ── Step 2: Build symbol list (skip stablecoins)
    const nonStable = activeBalances.filter(
      (b: { asset: string }) => b.asset !== "USDT" && b.asset !== "USDC"
    );
    const symbolsNeeded = nonStable.map((b: { asset: string }) => `${b.asset}USDT`);

    // ── Step 3: Fetch prices for only needed symbols — fast, small payload
    const priceMap = new Map<string, number>();
    const changeMap = new Map<string, number>();

    if (symbolsNeeded.length > 0) {
      try {
        const url = `https://api.mexc.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbolsNeeded))}`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });
        if (res.ok) {
          const data: Array<{ symbol: string; price: string }> = await res.json();
          if (Array.isArray(data)) {
            data.forEach(item => priceMap.set(item.symbol, parseFloat(item.price)));
          }
        }
      } catch (e) {
        console.warn("[Summary] Price fetch failed:", e);
      }
    }

    let totalValueCurrent = 0;
    let totalChangeUsdt = 0;
    let assetsCount = activeBalances.length;

    activeBalances.forEach((balance: { asset: string; free: string; locked: string }) => {
      const sym = balance.asset;
      const totalQty = parseFloat(balance.free) + parseFloat(balance.locked);
      let price = 0;
      let changeUsdt = 0;

      if (sym === "USDT" || sym === "USDC") {
        price = 1;
        changeUsdt = 0;
      } else {
        price = priceMap.get(`${sym}USDT`) || 0;
        changeUsdt = changeMap.get(`${sym}USDT`) || 0;
      }

      totalValueCurrent += totalQty * price;
      totalChangeUsdt += changeUsdt;
    });

    const initialValue = totalValueCurrent - totalChangeUsdt;
    const changePercentage = initialValue > 0 ? (totalChangeUsdt / initialValue) * 100 : 0;

    return NextResponse.json({
      totalValue: totalValueCurrent,
      change24h: totalChangeUsdt,
      changePercentage: changePercentage,
      assets: assetsCount,
      mode: mode,
    });
  } catch (error) {
    const err = error as Error;
    console.error("[PortfolioSummary] 500 Error:", err);
    return NextResponse.json(
      {
        error: err.message,
        stack: err.stack,
      },
      { status: 500 },
    );
  }
}
