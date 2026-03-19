import fs from "fs";
import path from "path";

/**
 * Audit Pipeline: API Security & Isolation Check
 * Scans all API routes to ensure they use getSessionUser() for protection.
 */

const API_DIR = path.join(process.cwd(), "src/app/api");
const PUBLIC_ROUTES = [
  "auth/login",
  "auth/register",
  "auth/google",
  "health",
  "db/init",
  "cron/alarms",
  "cron/portfolio-snapshot",
  "cron/price-history",
  "cron/strategies",
  "cron/trailing-stop",
  "cron/dca",
  "debug"
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

async function runAudit() {
  console.log("🚀 Starting API Security Audit Pipeline...");
  console.log("------------------------------------------");

  const allFiles = getAllFiles(API_DIR);
  const routeFiles = allFiles.filter(f => f.endsWith("route.ts"));
  
  const issues: string[] = [];
  let checked = 0;

  routeFiles.forEach(file => {
    const relativePath = path.relative(API_DIR, file).replace(/\\/g, "/");
    const routeName = path.dirname(relativePath);
    
    // Skip public routes
    if (PUBLIC_ROUTES.some(pr => routeName.startsWith(pr))) {
      return;
    }

    checked++;
    const content = fs.readFileSync(file, "utf8");
    
    const hasGetSessionUser = content.includes("getSessionUser");
    const hasUserIdUsage = content.includes("userId") || content.includes("user_id") || content.includes("user.id");

    if (!hasGetSessionUser) {
      issues.push(`❌ [MISSING_AUTH] ${relativePath} - No getSessionUser() found!`);
    } else if (!hasUserIdUsage) {
       issues.push(`⚠️ [POTENTIAL_LEAK] ${relativePath} - Auth found but no explicit userId filtering seen.`);
    }
  });

  console.log(`Audit Summary:`);
  console.log(`- Routes Scanned: ${checked}`);
  console.log(`- Issues Found: ${issues.length}`);
  console.log("------------------------------------------");

  if (issues.length > 0) {
    issues.forEach(issue => console.log(issue));
    process.exit(1);
  } else {
    console.log("✅ All protected API routes passed the security check.");
  }
}

runAudit().catch(err => {
  console.error("Audit Pipeline Failed:", err);
  process.exit(1);
});
