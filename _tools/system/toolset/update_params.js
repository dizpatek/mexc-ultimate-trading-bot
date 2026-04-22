import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL or DATABASE_URL must be set");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function updateParams() {
  const userId = 1;

  try {
    const { rows } = await pool.query(
      `SELECT pilot_tp_deviation, pilot_mtf_short_threshold, timeframe_settings FROM bot_configs WHERE user_id = $1`,
      [userId],
    );

    if (!rows.length) {
      throw new Error(`No bot_configs row found for user_id=${userId}`);
    }

    const tfs = rows[0]?.timeframe_settings || {};
    console.log("BEFORE:");
    console.log("  TP Deviation:", rows[0]?.pilot_tp_deviation);
    console.log("  MTF Short Threshold:", rows[0]?.pilot_mtf_short_threshold);
    console.log("  Cover SL%:", tfs.cover_sl_percent);
    console.log("  TP Dev (TFS):", tfs.pilot_tp_deviation);

    tfs.cover_sl_percent = 1.5;
    tfs.pilot_tp_deviation = 0.1;

    await pool.query(
      `UPDATE bot_configs SET
        timeframe_settings = $1::jsonb,
        pilot_tp_deviation = $2,
        pilot_mtf_short_threshold = $3,
        updated_at = $4
       WHERE user_id = $5`,
      [JSON.stringify(tfs), 0.1, 28, new Date(), userId],
    );

    const { rows: after } = await pool.query(
      `SELECT pilot_tp_deviation, pilot_mtf_short_threshold, timeframe_settings FROM bot_configs WHERE user_id = $1`,
      [userId],
    );

    const aTfs = after[0]?.timeframe_settings || {};
    console.log("\nAFTER:");
    console.log("  TP Deviation:", after[0]?.pilot_tp_deviation);
    console.log("  MTF Short Threshold:", after[0]?.pilot_mtf_short_threshold);
    console.log("  Cover SL%:", aTfs.cover_sl_percent);
    console.log("  TP Dev (TFS):", aTfs.pilot_tp_deviation);

    console.log("\n✅ Parametreler güncellendi!");
  } finally {
    await pool.end();
  }
}

updateParams().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
