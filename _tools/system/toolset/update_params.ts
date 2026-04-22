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

type TimeframeSettings = {
  cover_sl_percent?: number;
  pilot_tp_deviation?: number;
  [key: string]: unknown;
};

async function updateParams() {
  const { sql } = await import("../../../src/lib/postgres");
  const userId = 1;

  // Read current timeframe_settings
  const { rows } =
    await sql`SELECT pilot_tp_deviation, pilot_mtf_short_threshold, timeframe_settings FROM bot_configs WHERE user_id = ${userId}`;
  const tfs: TimeframeSettings =
    (rows[0]?.timeframe_settings as TimeframeSettings | null) ?? {};
  console.log("BEFORE:");
  console.log("  TP Deviation:", rows[0]?.pilot_tp_deviation);
  console.log("  MTF Short Threshold:", rows[0]?.pilot_mtf_short_threshold);
  console.log("  Cover SL%:", tfs.cover_sl_percent);
  console.log("  TP Dev (TFS):", tfs.pilot_tp_deviation);

  // Update values based on audit findings
  tfs.cover_sl_percent = 1.5; // Was 0.9 → too tight, TSL never had room
  tfs.pilot_tp_deviation = 0.1; // Was 0.18 → too wide, profit eroded

  await sql`UPDATE bot_configs SET 
    timeframe_settings = ${JSON.stringify(tfs)}::jsonb,
    pilot_tp_deviation = 0.10,
    pilot_mtf_short_threshold = 28,
    updated_at = ${new Date()}
    WHERE user_id = ${userId}`;

  // Verify
  const { rows: after } =
    await sql`SELECT pilot_tp_deviation, pilot_mtf_short_threshold, timeframe_settings FROM bot_configs WHERE user_id = ${userId}`;
  const aTfs: TimeframeSettings =
    (after[0]?.timeframe_settings as TimeframeSettings | null) ?? {};
  console.log("\nAFTER:");
  console.log("  TP Deviation:", after[0]?.pilot_tp_deviation);
  console.log("  MTF Short Threshold:", after[0]?.pilot_mtf_short_threshold);
  console.log("  Cover SL%:", aTfs.cover_sl_percent);
  console.log("  TP Dev (TFS):", aTfs.pilot_tp_deviation);

  console.log("\n✅ Parametreler güncellendi!");
  process.exit(0);
}

updateParams().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
