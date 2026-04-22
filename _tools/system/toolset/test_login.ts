import { authenticateUser } from "../../../src/lib/auth-utils";

async function testLogin() {
    console.log("Testing login for tester@test.com...");
    try {
        const result = await authenticateUser("tester@test.com", "123456");
        console.log("LOGIN RESULT:", result);
    } catch (e) {
        console.error("LOGIN FATAL ERROR:", e);
    }
}

testLogin();
