
import { getBotConfig } from "./src/lib/db";

async function check() {
    const config = await getBotConfig();
    console.log("Current Bot Config:", JSON.stringify(config, null, 2));
}

check().catch(console.error);
