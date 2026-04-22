
import { GET } from "../src/app/api/settings/keys/route";
import { generateToken } from "../src/lib/auth-utils";

async function verify() {
  console.log("Verifying API Route Logic...");
  const user = { id: 1, email: "admin@matrix.com", username: "admin", is_admin: true };
  const token = generateToken(user);

  // Mock Request object
  const req = {
    headers: new Map([["authorization", `Bearer ${token}`]]),
    method: "GET"
  } as any;

  try {
    const response = await GET(req);
    const data = await response.json();
    console.log("API Response Status:", response.status);
    console.log("API Response Data:", JSON.stringify(data, null, 2));

    if (response.status === 200 && data.hasKeys !== undefined) {
      console.log("✅ Verification Successful!");
    } else {
      console.error("❌ Verification Failed!");
    }
  } catch (err) {
    console.error("❌ Verification crashed with error:", err);
  } finally {
    process.exit();
  }
}

verify();
