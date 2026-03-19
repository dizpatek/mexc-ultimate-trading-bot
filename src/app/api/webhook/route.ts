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

    const { signal, pair, userId: payloadUserId } = payload;
    const userId = Number(payloadUserId || 1);

    // P4.1: Robust Multi-User Webhook Validation
    const { getSetting } = await import("@/lib/settings");
    const userSecret = await getSetting("WEBHOOK_SECRET", userId);
    const systemSecret = process.env.WEBHOOK_SECRET;

    // Validate using user-specific secret or fallback to system secret (only if user 1)
    const effectiveSecret = userSecret || (userId === 1 ? systemSecret : null);

    if (!effectiveSecret || incomingSecret !== effectiveSecret) {
      console.warn(`[Webhook] Auth Failed for User ${userId}. Expected secret not matched.`);
      return NextResponse.json({ error: "invalid secret for this user" }, { status: 401 });
    }

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

    console.log(`[Webhook] Valid signal received for User ${userId}: ${signal} ${pair}`);

    if (signal === "buy") {
      const result = await handleBuySignal({ ...payload, pair, userId });
      return NextResponse.json({ ok: true, result });
    } else if (signal === "sell") {
      const result = await handleSellSignal({ ...payload, pair, userId });
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
