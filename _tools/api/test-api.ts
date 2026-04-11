import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function check() {
  const res = await fetch("http://localhost:3000/api/portfolio/holdings", {
    headers: {
        cookie: "session=test" // Assuming no auth? No, auth uses jwt or next-auth.
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.substring(0, 1000));
}
check().catch(console.error);
