import { ensureTablesExist } from "../../src/lib/db-init";
import { initAutoResearchTable } from "../../src/lib/db";

async function initializeDB() {
    console.log("🚀 Starting Full DB Initialization...");
    try {
        await ensureTablesExist();
        await initAutoResearchTable();
        console.log("✅ DB Initialization successful (All Tables created).");
        process.exit(0);
    } catch (err: any) {
        console.error("❌ Error during DB Initialization:", err.message);
        process.exit(1);
    }
}

initializeDB();
