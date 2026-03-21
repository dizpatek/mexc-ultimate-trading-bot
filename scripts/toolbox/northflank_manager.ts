/**
 * 🛠️ NORTHFLANK MANAGER
 * Project: mexc2026 / Service: mexc-trading-bot
 */

import fs from 'fs';
import path from 'path';

// 🛡️ Load environment variables from northflank-deploy/.env
const rootDir = process.cwd();
const envPath = path.join(rootDir, 'scripts', 'northflank-deploy', '.env');
const envData = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (key: string) => {
  const match = envData.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
};

const NF_API_TOKEN = getEnv('NF_API_TOKEN');
const BASE_URL = 'https://api.northflank.com/v1';

if (!NF_API_TOKEN) {
  console.error('❌ Error: NF_API_TOKEN not found in scripts/northflank-deploy/.env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${NF_API_TOKEN}`,
  'Content-Type': 'application/json'
};

async function nfRequest(endpoint: string, method = 'GET', body = null) {
  const options: any = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data: any = await response.json();
  if (!response.ok) return { error: data.error?.message || response.statusText, status: response.status };
  return data;
}

async function getStatus() {
  const projectId = 'mexc2026';
  const serviceId = 'mexc-trading-bot';
  
  console.log(`\n--- 🛡️ NORTHFLANK STATUS: ${projectId} / ${serviceId} ---`);
  const service = await nfRequest(`/projects/${projectId}/services/${serviceId}`);
  if (service?.data) {
    const s = service.data;
    console.log(`📡 Service: ${s.name} (Type: ${s.serviceType})`);
    if (s.status) {
      console.log(`🏗️ Build Status: ${s.status.build?.status || 'N/A'}`);
      console.log(`🚀 Deploy Status: ${s.status.deployment?.status || 'N/A'}`);
    }
  }

  const buildData = await nfRequest(`/projects/${projectId}/services/${serviceId}/build`);
  if (buildData?.data?.builds) {
    console.log(`\n🐳 Recent Builds (Latest 3):`);
    buildData.data.builds.slice(0, 3).forEach((b: any) => {
      const icon = b.status === 'success' ? '✅' : b.status === 'failed' ? '❌' : '⏳';
      console.log(`   - ${icon} ${b.id.slice(0,8)}... | ${b.status} | ${b.createdAt}`);
    });
  }
}

async function getLogs() {
  const projectId = 'mexc2026';
  const serviceId = 'mexc-trading-bot';
  console.log(`\n--- 📜 RECENT LOGS: ${serviceId} ---`);
  const logs = await nfRequest(`/projects/${projectId}/services/${serviceId}/logs`);
  if (logs?.data?.logs) {
    logs.data.logs.slice(-20).forEach((l: any) => console.log(`[${l.timestamp.split('T')[1].split('.')[0]}] ${l.message}`));
  }
}

async function triggerBuild() {
  const projectId = 'mexc2026';
  const serviceId = 'mexc-trading-bot';
  console.log(`\n🚀 Triggering NEW BUILD/DEPLOY for ${serviceId}...`);
  const response = await nfRequest(`/projects/${projectId}/services/${serviceId}/build`, 'POST');
  if (response?.data) {
    console.log(`✅ Success! New Build ID: ${response.data.id}`);
  } else {
    console.error('❌ Error:', response.error);
  }
}

// Map command line arguments
const command = process.argv[2] || 'status';

(async () => {
    switch (command) {
        case 'status': await getStatus(); break;
        case 'logs': await getLogs(); break;
        case 'deploy': await triggerBuild(); break;
        default:
            console.log(`
Available commands:
  status   (Default)
  logs     (Recent logs)
  deploy   (Trigger build & deploy)
            `);
    }
})();
