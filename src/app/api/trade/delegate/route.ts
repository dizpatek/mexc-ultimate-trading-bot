import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getOrderById } from "@/lib/db";

export async function PUT(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID required" }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let meta = typeof order.meta === 'string' ? JSON.parse(order.meta) : order.meta;
    
    if (!meta.payload) {
      meta.payload = {};
    }

    const oldSource = meta.payload.source || "manual";
    meta.payload.source = "pilot_auto";
    
    // P5.2: Ensure we log the delegation event in monitorLogs
    if (!meta.monitorLogs) meta.monitorLogs = [];
    meta.monitorLogs.push(`${new Date().toISOString()}: [Delegation] İşlem Manuel'den Pilot'a devredildi. (Eski: ${oldSource})`);

    await sql`
      UPDATE orders 
      SET meta = ${JSON.stringify(meta)}::jsonb, updated_at = ${Date.now()} 
      WHERE id = ${orderId}
    `;

    console.log(`[API] Order ${orderId} delegated to Pilot by user.`);

    return NextResponse.json({ 
      success: true, 
      message: "İşlem başarıyla otopilota devredildi. Mevcut ayarlarınızla takip edilecek." 
    });
  } catch (error: any) {
    console.error("[API] Delegate Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
