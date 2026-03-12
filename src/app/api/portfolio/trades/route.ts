import { NextResponse } from "next/server";
import { getTradeHistory } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-utils";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const mode = (cookieStore.get("TRADING_MODE")?.value as "test" | "production") || "test";

    const tradeHistory = await getTradeHistory(limit, mode);

    const safeDate = (dateVal: unknown) => {
      const d = new Date(dateVal as string | number | Date);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };

    const trades = tradeHistory.map((trade) => ({
      id: String(trade.id),
      symbol: trade.symbol as string,
      type: (trade.side as string).toLowerCase(),
      price: trade.price,
      amount: trade.qty,
      total: trade.quote_qty,
      time: safeDate(trade.created_at),
      status: "completed",
      profitLoss: trade.profit_loss,
      profitLossPercentage: trade.profit_loss_percentage,
    }));

    return NextResponse.json(trades);
  } catch (error: unknown) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 },
    );
  }
}
