import { runActiveStrategies } from "./src/lib/strategy-engine";
import { monitorSmartTrades } from "./src/lib/smart-trade-monitor";
import { logSystemEvent } from "./src/lib/db";

async function wake() {
    console.log("--- WAKING UP BOT ---");
    await logSystemEvent(1, "INFO", "🛠️ MANUEL TETİKLEME: Sistem canlandırılıyor...");
    
    console.log("1. Running Active Strategies (Scanner)...");
    await runActiveStrategies(true, 1, "test");
    
    console.log("2. Running Smart Monitor (Trade Tracker)...");
    await monitorSmartTrades();
    
    console.log("--- WAKE COMPLETE ---");
    process.exit(0);
}

wake().catch(err => {
    console.error("Wake failed:", err);
    process.exit(1);
});
