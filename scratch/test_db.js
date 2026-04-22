
const { getMexcCredentials, getSetting } = require("./src/lib/settings");
const { getUserById } = require("./src/lib/db");

async function test() {
  try {
    console.log("Testing DB connection and settings...");
    const user = await getUserById(1);
    console.log("User 1:", user ? "Found" : "Not Found");
    
    if (user) {
      const creds = await getMexcCredentials(1, "production");
      console.log("Credentials:", creds);
      
      const mode = await getSetting("TRADING_MODE", 1);
      console.log("Trading Mode Setting:", mode);
    }
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit();
  }
}

test();
