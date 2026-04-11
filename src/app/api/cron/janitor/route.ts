import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";

export async function GET(request: Request) {
  // CRON_SECRET koruması
  const authHeader = request.headers.get("Authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // 1. 30 günden eski trading_history kayıtlarını sil
    const resTrades = await sql`DELETE FROM trade_history WHERE created_at < ${thirtyDaysAgo}`;
    
    // 2. Redis'e tam geçmeden önceki kalıntı Postgres system_logs tablosunu sil/kısalt
    // (Redis'e geçtikten sonra bu işleme gerek kalmayacak, ama önceki loglar temizlensin)
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    const resLogs = await sql`DELETE FROM system_logs WHERE timestamp < ${twoDaysAgo}`;

    console.log(`[Janitor] Temizlendi: ${resTrades.rowCount} eski işlem, ${resLogs.rowCount} eski sistem logu.`);

    return NextResponse.json({
      success: true,
      message: "Veritabanı temizliği tamamlandı",
      deleted_trades: resTrades.rowCount,
      deleted_logs: resLogs.rowCount
    });
  } catch (error: unknown) {
    console.error("[Janitor] Temizlik sırasında hata:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
