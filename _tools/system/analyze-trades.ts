import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes("sslmode")) {
  if (process.env.POSTGRES_URL.includes("?")) {
    process.env.POSTGRES_URL += "&sslmode=require";
  } else {
    process.env.POSTGRES_URL += "?sslmode=require";
  }
}
(process.env as Record<string, string | undefined>).NODE_ENV ??= "production";

async function analyzeActiveTrades() {
  let hasError = false;

  try {
    const { sql } = await import("../../src/lib/postgres");

    console.log("==================================================");
    console.log("🔍 AKTIF ISLEMLER (PENDING ORDERS) ANALIZI");
    console.log("==================================================");

    // Fetch active/pending orders
    const { rows } = await sql`
      SELECT 
        id, 
        user_id,
        symbol, 
        side, 
        type,
        price, 
        status, 
        created_at, 
        meta
      FROM orders
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const rawData: any[] = rows as any[];

    const data = rawData.filter((row: any) => {
      try {
        const meta =
          typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta || {};
        const isUiActive = row.status !== "CLOSED" && row.status !== "ARCHIVED";
        const isDbActive =
          meta.tradeState === "TRADE_ACTIVE" ||
          meta.tradeState === "COVER_SOLD";

        // Report mismatch!
        if (row.user_id === 1 && isUiActive !== isDbActive) {
          console.log(`\n🚨 TUTARSIZLIK TESPİT EDİLDİ - ID: ${row.id}`);
          console.log(
            `UI 'Aktif' diyor mu? ${isUiActive ? "EVET" : "HAYIR"} (SQL status: ${row.status})`,
          );
          console.log(
            `DB Script 'Aktif' diyor mu? ${isDbActive ? "EVET" : "HAYIR"} (tradeState: ${meta.tradeState})`,
          );
        }

        // To be accurate with UI for user admin panel (user_id=1), we will filter like the UI does:
        return row.user_id === 1 && isUiActive;
      } catch (e) {
        return false;
      }
    });

    if (data.length === 0) {
      console.log(
        "Şu anda sistemde açık/bekleyen (PENDING/OPEN) hiçbir işlem bulunmuyor.",
      );
      return;
    }

    console.log(`Toplam Aktif İşlem Sayısı: ${data.length}\n`);

    for (const row of data) {
      // Parse JSON defensively
      let metaObj: any = {};
      try {
        metaObj =
          typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta || {};
      } catch (e) {}

      const meta: any = metaObj;
      const payload: any = meta.payload || {};

      const entryPrice = parseFloat(row.price);
      const markPrice = payload.current_price
        ? parseFloat(payload.current_price)
        : meta.mark_price
          ? parseFloat(meta.mark_price)
          : entryPrice;

      const slPrice = payload.sl_price || meta.sl_price;
      const tpPrice = payload.tp_price || meta.tp_price;
      const tslPrice = meta.tsl_price;
      const tslActive = meta.tsl_active ? "EVET" : "HAYIR";
      const highestPrice = meta.highest_seen_price;
      const lowestPrice = meta.lowest_seen_price;
      const tradeStatusInfo = meta.trade_status_info || "Bilinmiyor";
      const source = payload.source || "Bilinmiyor";

      // Calculate PNL based on side and assumed current mark price (from meta if available, else zero)
      let pnlPerc = 0;
      if (row.side === "BUY" && markPrice > 0) {
        pnlPerc = ((markPrice - entryPrice) / entryPrice) * 100;
      } else if (row.side === "SELL" && markPrice > 0) {
        pnlPerc = ((entryPrice - markPrice) / entryPrice) * 100;
      }

      console.log(
        `[#${row.id}] ${row.symbol} | Yön: ${row.side} | User: ${row.user_id} | Kaynak: ${source}`,
      );
      console.log(`  - Giriş Fiyatı: $${entryPrice}`);
      console.log(
        `  - İşlem Tarihi: ${new Date(Number(row.created_at)).toLocaleString("tr-TR")}`,
      );
      console.log(
        `  - İzlenen Fiyat (Kayıtlardaki Son Fiyat): $${markPrice} (Kar: %${pnlPerc.toFixed(2)})`,
      );
      console.log(
        `  - Limitler: SL: ${slPrice ? "$" + parseFloat(slPrice) : "Yok"} | TP: ${tpPrice ? "$" + parseFloat(tpPrice) : "Yok"}`,
      );
      console.log(
        `  - Trailing Verisi: TSL Hedefi: ${tslPrice ? "$" + parseFloat(tslPrice) : "Devreye Girmedi"} | TSL Aktif mi? ${tslActive}`,
      );
      if (highestPrice)
        console.log(`  - Görülen En Yüksek Fiyat: $${highestPrice}`);
      if (lowestPrice)
        console.log(`  - Görülen En Düşük Fiyat: $${lowestPrice}`);
      console.log(`  - Otopilot Karar Durumu: ${tradeStatusInfo}`);
      console.log("--------------------------------------------------");
    }
  } catch (err) {
    hasError = true;
    console.error("Hata:", err);
  } finally {
    process.exit(hasError ? 1 : 0);
  }
}

analyzeActiveTrades();
