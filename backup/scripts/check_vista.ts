
import { sql } from "../src/lib/postgres";

async function checkVista() {
  try {
    const { rows } = await sql`
      SELECT * FROM orders 
      WHERE symbol LIKE '%VISTA%' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      console.log("No orders found for VISTA");
      return;
    }

    const order = rows[0];
    console.log("Last Order for VISTA:");
    console.log(JSON.stringify(order, null, 2));
    
    // Also check bot config
    const { rows: configRows } = await sql`SELECT * FROM bot_configs WHERE user_id = ${order.user_id}`;
    console.log("\nBot Config for User:");
    console.log(JSON.stringify(configRows[0], null, 2));

  } catch (err) {
    console.error("Error checking VISTA:", err);
  } finally {
    process.exit(0);
  }
}

checkVista();
