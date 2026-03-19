
const { sql } = require("./src/lib/postgres");

async function check() {
  try {
    console.log("Checking database...");
    const signals = await sql`SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 10`;
    console.log("--- LATEST SIGNALS ---");
    console.table(signals.rows.map(s => ({
        symbol: s.symbol,
        type: s.signal_type,
        executed: s.executed,
        time: new Date(Number(s.timestamp)).toLocaleString(),
        mode: s.trading_mode
    })));

    const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 10`;
    console.log("--- LATEST ORDERS ---");
    console.table(orders.rows.map(o => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        status: o.status,
        mode: o.trading_mode,
        time: new Date(Number(o.created_at)).toLocaleString()
    })));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
}

check();
