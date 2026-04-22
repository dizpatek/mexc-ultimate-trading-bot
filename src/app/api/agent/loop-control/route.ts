/**
 * API Route: /api/agent/loop-control
 * GET  → Döngü durumunu verir (aktif mi, iteration, vs)
 * POST → "action: start | stop"
 */

import { NextRequest, NextResponse } from "next/server";
import { startLoop, stopLoop, getLoopStatus } from "@/lib/autonomous-loop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, status: getLoopStatus() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();
    if (action === "start") {
      startLoop();
      return NextResponse.json({ ok: true, message: "Otonom döngü başlatıldı." });
    } else if (action === "stop") {
      stopLoop();
      return NextResponse.json({ ok: true, message: "Otonom döngü durduruldu." });
    }
    return NextResponse.json({ ok: false, error: "Geçersiz aksiyon." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
