import { NextRequest, NextResponse } from "next/server";
import { checkPriceGap } from "@/lib/mexc";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") || "BTCUSDT";
  try {
    const data = await checkPriceGap(symbol);
    return NextResponse.json(data || null);
  } catch {
    return NextResponse.json(null);
  }
}
