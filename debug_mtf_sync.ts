import axios from 'axios';

async function debug() {
  const symbols = ['BNBUSDT', 'DOTUSDT'];
  const intervals = ['15m', '1h', '4h', '1d', '1w'];
  
  console.log('--- MTF DEBUG REPORT ---');
  
  for (const interval of intervals) {
    console.log(`\n[Interval: ${interval}]`);
    try {
      const res = await axios.post('http://localhost:3000/api/indicators/f4/bulk', {
        symbols,
        interval,
        riskMode: 'normal'
      });
      
      const results = res.data?.results || [];
      results.forEach((r: any) => {
        console.log(`Symbol: ${r.symbol.padEnd(8)} | Trend: ${r.trend?.padEnd(8)} | UpProb: ${r.prediction?.upProb}% | Signal: ${r.signal}`);
      });
    } catch (e: any) {
      console.error(`Error for ${interval}:`, e.message);
    }
  }
}

debug();
