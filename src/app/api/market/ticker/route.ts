import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols");
    const symbol = searchParams.get("symbol");

    let url = "https://api.mexc.com/api/v3/ticker/price";
    if (symbol) {
      url += `?symbol=${encodeURIComponent(symbol)}`;
    } else if (symbols) {
      url += `?symbols=${encodeURIComponent(symbols)}`;
    }

    const response = await fetch(url, {
      next: { revalidate: 0 }, // Disable caching for prices
    });

    if (!response.ok) {
      throw new Error(`MEXC API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
