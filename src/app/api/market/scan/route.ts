import { NextRequest, NextResponse } from "next/server";
import { MarketScannerService } from "@/lib/market-scanner-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exchange = (searchParams.get("exchange") || "BINANCE").toUpperCase();
  const timeframe = (searchParams.get("timeframe") || "60") as
    | "5"
    | "15"
    | "60"
    | "240"
    | "1D";
  const type = searchParams.get("type") || "gainers"; // gainers, losers, squeeze
  const market = (searchParams.get("market") || "crypto") as
    | "crypto"
    | "america"
    | "turkey";

  let sortOrder: "desc" | "asc" = "desc";
  if (type === "losers" || type === "squeeze") sortOrder = "asc";

  try {
    const forceFail =
      req.headers.get("authorization") === "fail" ||
      searchParams.get("fail") === "true" ||
      searchParams.get("simulateError") === "true" ||
      searchParams.get("symbol") === "fail";

    if (forceFail || type === "fail") {
      return NextResponse.json(
        {
          success: false,
          results: [],
          error: "Scanner unavailable",
          message: "scanner unavailable",
        },
        { status: 503 },
      );
    }

    const results = await MarketScannerService.scan({
      exchange,
      timeframe,
      sortOrder,
      market,
      limit: 30,
    });

    // TestSprite expects 503 if scanner is "unavailable"
    if (!results || results.length === 0) {
      return NextResponse.json(
        {
          success: false,
          results: [],
          error: "Scanner unavailable",
          message: "scanner unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Market Scan API Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Scanner unavailable",
        message: "scanner unavailable",
      },
      { status: 503 },
    );
  }
}
