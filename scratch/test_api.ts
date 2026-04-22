
import { generateToken } from "../src/lib/auth-utils";
import axios from "axios";

async function testApi() {
  const user = { id: 1, email: "admin@matrix.com", username: "admin", is_admin: true };
  const token = generateToken(user);
  console.log("Generated Token:", token);

  const url = "http://localhost:3000/api/settings/keys";
  try {
    console.log("Calling GET /api/settings/keys...");
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Success:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("API Failed with status:", err.response.status);
      console.error("Error Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error:", err.message);
    }
  }
}

testApi();
