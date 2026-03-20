
import axios from "axios";

async function checkApiFormat() {
  try {
    const res = await axios.post("http://localhost:3000/api/indicators/f4/bulk", {
      symbols: ["BNBUSDT", "DOTUSDT"],
      interval: "1h",
      riskMode: "normal"
    });
    console.log("--- BULK API RESULTS ---");
    if (res.data && res.data.results) {
      res.data.results.forEach((r: any) => {
        console.log(`Symbol: ${r.symbol} | Signal: ${r.signal} | AI Score: ${r.aiScore} | Trend: ${r.trend}`);
      });
    } else {
      console.log("No results or weird format:", JSON.stringify(res.data));
    }
  } catch (e: any) {
    console.error("API Call failed:", e.message);
    if (e.response) console.log("Response data:", e.response.data);
  }
  process.exit(0);
}

checkApiFormat();
