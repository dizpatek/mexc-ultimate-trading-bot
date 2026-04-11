import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") || "BTCUSDT";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  try {
    const resp = await fetch(`https://api.mexc.com/api/v3/depth?symbol=${symbol}&limit=${Math.min(limit, 50)}`);
    if (!resp.ok) throw new Error("MEXC API error");
    const depth = await resp.json() as { bids: string[][]; asks: string[][] };

    const midPrice = (parseFloat(depth.bids[0][0]) + parseFloat(depth.asks[0][0])) / 2;
    
    let bidVolume = 0;
    let askVolume = 0;

    depth.bids.forEach(([priceStr, qtyStr]) => {
      const price = parseFloat(priceStr);
      if (price >= midPrice * 0.98) bidVolume += parseFloat(qtyStr) * price;
    });

    depth.asks.forEach(([priceStr, qtyStr]) => {
      const price = parseFloat(priceStr);
      if (price <= midPrice * 1.02) askVolume += parseFloat(qtyStr) * price;
    });

    return NextResponse.json({
      bids: depth.bids,
      asks: depth.asks,
      buyWallWeight: bidVolume,
      sellWallWeight: askVolume,
      ratio: bidVolume / (askVolume || 1),
      imbalance: bidVolume > askVolume ? "BULLISH" : "BEARISH",
      midPrice
    });
  } catch {
    return NextResponse.json({ bids: [], asks: [], buyWallWeight: 0, sellWallWeight: 0, ratio: 1, imbalance: "NEUTRAL", midPrice: 0 });
  }
}
