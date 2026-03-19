import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { getKlines } from "@/lib/mexc-wrapper";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval");
    const limit = searchParams.get("limit") || "200";

    if (!symbol || !interval) {
      return NextResponse.json(
        { error: "Symbol and interval are required parameters" },
        { status: 400 }
      );
    }

    const data = await getKlines(symbol, interval, parseInt(limit));
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to fetch klines:", error);
    return NextResponse.json(
      { error: "Failed to fetch kline data from exchange" },
      { status: 500 }
    );
  }
}
