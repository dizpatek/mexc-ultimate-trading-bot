import { Client } from "pg";

async function forceTruncate() {
    const url = process.env.DATABASE_URL || "postgresql://_189019fee2eb8cdf:_def148f9291522b0ba075e16883abe@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29790/_68afee465836?sslmode=require";
    const client = new Client({ connectionString: url });

    console.log("⚡ [Emergency] Force Truncate Starting...");
    try {
        await client.connect();
        console.log("Connected. Truncating large tables...");
        await client.query("TRUNCATE TABLE market_trades;");
        console.log("✅ market_trades truncated.");
        await client.query("TRUNCATE TABLE system_logs;");
        console.log("✅ system_logs truncated.");
        await client.end();
        console.log("🎉 DB should be free now.");
    } catch (err: any) {
        console.error("❌ Force Truncate Failed:", err.message);
        await client.end().catch(() => {});
        process.exit(1);
    }
}

forceTruncate();
