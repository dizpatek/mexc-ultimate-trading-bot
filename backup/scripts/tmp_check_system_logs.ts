import { sql } from './src/lib/postgres.ts';

async function checkSystemLogs() {
  try {
    const scannerLogs = await sql`SELECT * FROM system_logs WHERE message LIKE '%Scanner%' ORDER BY timestamp DESC LIMIT 20`;
    console.log("--- SCANNER LOGS ---");
    console.log(JSON.stringify(scannerLogs.rows, null, 2));

    const monitorLogs = await sql`SELECT * FROM system_logs WHERE message LIKE '%Monitor%' ORDER BY timestamp DESC LIMIT 10`;
    console.log("--- MONITOR LOGS ---");
    console.log(JSON.stringify(monitorLogs.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSystemLogs();
