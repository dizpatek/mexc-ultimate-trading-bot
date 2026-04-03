import { updateBotConfig } from "./src/lib/db";
import { config } from "dotenv";

config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function test() {
  try {
    console.log("Starting test...");
    await updateBotConfig(1, { f4_length: 14 });
    console.log("Test succeeded!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit();
  }
}

test();
