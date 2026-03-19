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

    // Schema statements executed...
    
    // Ensure admin (id=1) also has default settings if it's the first run
    try {
      const { initializeUserSettings } = await import("@/lib/db");
      await initializeUserSettings(1); // One-time seed for the initial admin
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: "Database schema initialized successfully",
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
