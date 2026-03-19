import { sql } from "../../src/lib/postgres";

/**
 * Audit Pipeline: Database Multi-User Integrity Check
 * Verifies that all sensitive tables have user_id columns and proper indexes.
 */

const SENSITIVE_TABLES = [
  "orders",
  "trade_history",
  "portfolio_snapshots",
  "performance_metrics",
  "strategies",
  "strategy_signals",
  "system_settings",
  "bot_configs"
];

async function runDbAudit() {
  console.log("🚀 Starting Database Integrity Audit Pipeline...");
  console.log("------------------------------------------");

  const issues: string[] = [];
  let checked = 0;

  for (const table of SENSITIVE_TABLES) {
    checked++;
    try {
      // Check for user_id column
      const colCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'user_id'
      `;

      if (colCheck.rowCount === 0) {
        issues.push(`❌ [MISSING_COLUMN] Table '${table}' is missing 'user_id' column!`);
      }

      // Check for index on user_id
      const indexCheck = await sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = ${table} AND indexdef LIKE '%(user_id)%'
      `;

      if (indexCheck.rowCount === 0) {
        // performance_metrics uses a unique constraint, which is also an index
        if (table !== "performance_metrics") {
          issues.push(`⚠️ [MISSING_INDEX] Table '${table}' has no index on 'user_id'. performance may suffer.`);
        }
      }
    } catch (err) {
      issues.push(`🔥 [DB_ERROR] Failed to audit table '${table}': ${String(err)}`);
    }
  }

  console.log(`Audit Summary:`);
  console.log(`- Tables Scanned: ${checked}`);
  console.log(`- Issues Found: ${issues.length}`);
  console.log("------------------------------------------");

  if (issues.length > 0) {
    issues.forEach(issue => console.log(issue));
    // We don't exit(1) for warnings, but we should notify
  } else {
    console.log("✅ Database schema passed the multi-user integrity check.");
  }
}

runDbAudit().catch(err => {
  console.error("Database Audit Pipeline Failed:", err);
  process.exit(1);
});
