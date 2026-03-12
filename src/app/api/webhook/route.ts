import { NextResponse } from "next/server";
import { handleBuySignal, handleSellSignal } from "@/lib/trade";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const SECRET = process.env.WEBHOOK_SECRET;

    const headerSecret = request.headers.get("x-webhook-secret");
    const incomingSecret = headerSecret || payload.secret;

    if (!SECRET || incomingSecret !== SECRET) {
      return NextResponse.json({ error: "invalid secret" }, { status: 401 });
    }

    const { signal, pair } = payload;

    if (!signal || !pair) {
      return NextResponse.json(
        { error: "signal and pair are required" },
        { status: 400 },
      );
    }

    // Validate pair format
    if (!/^[A-Z0-9]+USDT?$/.test(pair)) {
      return NextResponse.json(
        { error: "invalid pair format" },
        { status: 400 },
      );
    }

    if (signal === "buy") {
      // SECURITY: Explicitly hardcode or derive userId from a trusted source, ignore payload.userId (P3.1 fix)
      const result = await handleBuySignal({ ...payload, pair, userId: 1 });
      return NextResponse.json({ ok: true, result });
    } else if (signal === "sell") {
      // SECURITY: Explicitly hardcode or derive userId from a trusted source, ignore payload.userId (P3.1 fix)
      const result = await handleSellSignal({ ...payload, pair, userId: 1 });
      return NextResponse.json({ ok: true, result });
    } else {
      return NextResponse.json({ error: "unknown signal" }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
