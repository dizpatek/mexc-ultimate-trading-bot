import { NextResponse } from "next/server";
import {
  getAccountInfo,
  getPrice,
  get24hrTicker,
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
    const cookieStore = await cookies();
    const mode =
      (cookieStore.get("TRADING_MODE")?.value as TradingMode) || "test";

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


    const accountInfo = await getAccountInfo(user.id, mode);
    const activeBalances = (accountInfo.balances || []).filter(
      (b: { free: string; locked: string }) =>
        parseFloat(b.free) + parseFloat(b.locked) > 0,
    );

    let totalValueCurrent = 0;
    let totalChangeUsdt = 0;
    let assetsCount = 0;

    const assetResults = await Promise.all(
      activeBalances.map(
        async (balance: { asset: string; free: string; locked: string }) => {
          const sym = balance.asset;
          const totalQty =
            parseFloat(balance.free) + parseFloat(balance.locked);
          let price = 0;
          let changeUsdt = 0;

          if (sym === "USDT" || sym === "USDC") {
            price = 1;
            changeUsdt = 0;
          } else {
            try {
              price = await getPrice(`${sym}USDT`);
              const ticker = await get24hrTicker(`${sym}USDT`);
              if (ticker) {
                changeUsdt = parseFloat(ticker.priceChange || "0") * totalQty;
              }
            } catch {}
          }

          const value = totalQty * price;
          return { value, changeUsdt };
        },
      ),
    );

    totalValueCurrent = assetResults.reduce((a, b) => a + b.value, 0);
    totalChangeUsdt = assetResults.reduce((a, b) => a + b.changeUsdt, 0);
    assetsCount = activeBalances.length;

    const initialValue = totalValueCurrent - totalChangeUsdt;
    const changePercentage =
      initialValue > 0 ? (totalChangeUsdt / initialValue) * 100 : 0;

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
