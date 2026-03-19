const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://fapi.binance.com/fapi/v1/klines?symbol=ALTPERP&interval=1h&limit=2');
    console.log("ALTPERP:", res.data);
  } catch(e) {
    console.log("ALTPERP NOT FOUND", e.message);
  }
}
test();
