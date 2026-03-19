import { sql } from './src/lib/postgres.ts';

async function checkLogs() {
  try {
    const logs = await sql`
      SELECT id, symbol, signal_type, timeframe, execution_result 
      FROM strategy_signals 
      ORDER BY id DESC 
      LIMIT 10
    `;
    
    const plainLogs = logs.rows.map(r => {
      const res = JSON.parse(r.execution_result as string);
      return {
        id: r.id,
        symbol: r.symbol,
        type: r.signal_type,
        f4PowerLoss: res.f4PowerLoss,
        f4Power: res.f4Power,
        aiScore: res.aiScore
      };
    });
    
    console.log(JSON.stringify(plainLogs, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLogs();
