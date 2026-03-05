import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const schemaPath = path.resolve(process.cwd(), "scripts/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(
      `[DB Init] Starting initialization with ${statements.length} statements...`,
    );

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err: unknown) {
        // Ignore if table already exists, or other minor errors
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[DB Init] Warning executing statement: ${statement.substring(0, 50)}... Error: ${msg}`,
        );
      }
    }

    // Migration: Fix system_settings user_id if needed
    try {
      const { rows: nullUserRows } = await pool.query(
        "SELECT count(*) FROM system_settings WHERE user_id IS NULL",
      );
      if (parseInt(nullUserRows[0].count) > 0) {
        console.log(
          `[DB Init] Migrating ${nullUserRows[0].count} system_settings rows to user 1...`,
        );
        await pool.query(
          "UPDATE system_settings SET user_id = 1 WHERE user_id IS NULL",
        );
        await pool.query(
          "ALTER TABLE system_settings ALTER COLUMN user_id SET NOT NULL",
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        "[DB Init] system_settings migration check skipped (table might be new):",
        msg,
      );
    }

    // Seed default bot config if none exists
    const { rows: configs } = await pool.query(
      "SELECT * FROM bot_configs WHERE id = 1",
    );
    if (configs.length === 0) {
      const now = Date.now();
      await pool.query(
        "INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, timeframe, updated_at) VALUES (1, 10, 1.8, 65, false, false, '4h', $1)",
        [now],
      );
      console.log("[DB Init] Default bot config seeded");
    }

    return NextResponse.json({
      success: true,
      message: "Database initialization and migration completed",
    });
  } catch (error: unknown) {
    console.error("[DB Init] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
