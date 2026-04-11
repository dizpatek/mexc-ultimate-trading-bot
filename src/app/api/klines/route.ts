import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "1m";
  const limit = searchParams.get("limit") || "200";

  try {
    const resp = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    
    if (!resp.ok) {
      return NextResponse.json(
        { error: `MEXC API Error: ${resp.status}` }, 
        { status: resp.status }
      );
    }
    
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
