import { sql } from "../src/lib/postgres";

async function run() {
  try {
    console.log("Fetching orders for admin (user_id = 1)...");
    const { rows } = await sql`
      SELECT id, symbol, side, qty, price, status, created_at, meta
      FROM orders
      WHERE user_id = 1
      ORDER BY id DESC
      LIMIT 20;
    `;
    
    let profits = 0;
    let losses = 0;
    let totalPnl = 0;

    for (const row of rows) {
      let exitPrice = null;
      let m: any = {};
      if (row.meta) {
         try {
             m = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
             exitPrice = m.exitPrice;
         } catch(e) {}
      }

      if (row.status === 'CLOSED' && exitPrice) {
         const entry = parseFloat(row.price);
         const exit = parseFloat(exitPrice);
         if (entry && exit) {
            const diff = row.side === 'BUY' ? (exit - entry) / entry : (entry - exit) / entry;
            totalPnl += diff;
            if (diff > 0) profits++;
            else losses++;
         }
      }
      console.log(`[ID: ${row.id}] ${row.symbol} ${row.side} | Entry: ${row.price} | Exit: ${exitPrice || 'N/A'} | Status: ${row.status}`);
      if (m.exitReason) console.log(`  -> Exit Reason: ${m.exitReason}`);
      if (m.highestPrice) console.log(`  -> Highest: ${m.highestPrice}, Lowest: ${m.lowestPrice}`);
      if (m.payload && m.payload.stopLoss) console.log(`  -> TSL Setting: ${JSON.stringify(m.payload.stopLoss)}`);
      if (m.payload && m.payload.takeProfit) console.log(`  -> TP Setting: ${JSON.stringify(m.payload.takeProfit)}`);
    }
    console.log(`\nStats (Last 20): Profits: ${profits}, Losses: ${losses}, Total PNL: ${(totalPnl * 100).toFixed(2)}%`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
