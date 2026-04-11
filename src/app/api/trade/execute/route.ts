import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { handleBuySignal, handleSellSignal } from "@/lib/trade";
import { getPrice } from "@/lib/mexc-wrapper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("[DEBUG] Quick Trade Request:", body);
    const { symbol, side, usdtAmount, quantity } = body;

    if (!symbol || !side) {
      return NextResponse.json(
        { error: "Symbol and side are required" },
        { status: 400 },
      );
    }

    const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;

    if (side === "BUY") {
      const amountStr = usdtAmount || "10"; // Default 10 USDT
      const amountNum = parseFloat(amountStr.toString());

      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json({
          success: false,
          error: "Geçersiz USDT miktarı",
        });
      }

      console.log(`[DEBUG] Executing BUY for ${pair} with ${amountNum} USDT`);
      const result = await handleBuySignal({
        pair,
        usdt: amountNum,
        risk: 0.01,
        userId: user.id,
      });

      if (result.ok === false) {
        return NextResponse.json({ success: false, error: result.message });
      }

      return NextResponse.json({ success: true, result });
    } else if (side === "SELL") {
      let finalAmount = quantity ? parseFloat(quantity.toString()) : null;

      if (quantity && isNaN(finalAmount as number)) {
        return NextResponse.json({
          success: false,
          error: "Geçersiz satış miktarı",
        });
      }

      // If usdtAmount is provided for SELL, calculate quantity
      if (!finalAmount && usdtAmount) {
        try {
          const price = await getPrice(pair);
          if (price > 0) {
            const amtNum = parseFloat(usdtAmount.toString());
            if (!isNaN(amtNum)) {
              finalAmount = amtNum / price;
            }
          }
        } catch (e) {
          console.error("Price fetch error for SELL calculation:", e);
        }
      }

      console.log(
        `[DEBUG] Executing SELL for ${pair} with amount ${finalAmount}`,
      );
      const result = await handleSellSignal({
        pair,
        amount: finalAmount,
        percent: !finalAmount && !quantity ? 100 : null,
        userId: user.id,
      });

      if (result.ok === false) {
        return NextResponse.json({ success: false, error: result.message });
      }

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Invalid side" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Quick trade server error:", error);

    // Check if it's an axios error with a status code
     
    const axiosError = error as any;
    const status = axiosError.response?.status || 500;
    const message = axiosError.mexcDetail
      ? JSON.stringify(axiosError.mexcDetail)
      : error instanceof Error
        ? error.message
        : "Bilinmeyen hata";

    return NextResponse.json(
      {
        error:
          status === 500
            ? "Sunucu Hatası (Standard Trade)"
            : "İşlem Reddedildi",
        message: message,
        stack:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : undefined
            : undefined,
      },
      { status: status },
    );
  }
}
