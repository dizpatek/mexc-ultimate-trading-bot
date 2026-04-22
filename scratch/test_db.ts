
import { getMexcCredentials, getSetting } from "../src/lib/settings";
import { getUserById } from "../src/lib/db";
import { getAccountInfo } from "../src/lib/mexc";

async function test() {
  try {
    console.log("Testing DB connection and MEXC connectivity...");
    const user = await getUserById(1);
    console.log("User 1:", user ? "Found" : "Not Found");
    
    if (user) {
      const creds = await getMexcCredentials(1, "production");
      console.log("Credentials (Masked):", {
        apiKey: creds.apiKey ? `${creds.apiKey.substring(0, 4)}...` : "(empty)",
        apiSecret: creds.apiSecret ? "********" : "(empty)"
      });
      
      const mode = await getSetting("TRADING_MODE", 1);
      console.log("Trading Mode Setting:", mode);

      console.log("Calling getAccountInfo...");
      const account = await getAccountInfo(1);
      console.log("Account Info Result:", account ? "Success" : "Failed (Returned null)");
    }
  } catch (err) {
    console.error("Test failed with error:", err.message);
    if (err.response) {
       console.error("Axios Response Error Data:", err.response.data);
    }
  } finally {
    process.exit();
  }
}

test();
