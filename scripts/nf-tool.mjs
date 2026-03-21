/**
 * 🛠️ NORTHFLANK COMMAND TOOL (Consolidated)
 * Simplified CLI to manage mexc2026 project on Northflank.
 * Path: scripts/nf-tool.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🛡️ Load environment variables manually to avoid dependency on 'dotenv' package if not in main
// but normally, we should have it. Let's try to load it from northflank-deploy.
const envPath = path.join(__dirname, 'northflank-deploy', '.env');
const envData = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (key) => {
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

async function nfRequest(endpoint, method = 'GET', body = null) {
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok) return { error: data.error?.message || response.statusText, status: response.status };
  return data;
}

async function listProjects() {
  const data = await nfRequest('/projects');
  if (data?.data?.projects) {
    console.log('\n--- Projects ---');
    data.data.projects.forEach(p => console.log(`- ${p.name} (ID: ${p.id})`));
  }
}

async function listServices(projectId) {
  const data = await nfRequest(`/projects/${projectId}/services`);
  if (data?.data?.services) {
    console.log(`\n--- Services in ${projectId} ---`);
    data.data.services.forEach(s => console.log(`- ${s.name} (ID: ${s.id}) [Type: ${s.serviceType}]`));
  }
}

async function getStatus(projectId, serviceId) {
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
    buildData.data.builds.slice(0, 3).forEach(b => {
      const icon = b.status === 'success' ? '✅' : b.status === 'failed' ? '❌' : '⏳';
      console.log(`   - ${icon} ${b.id.slice(0,8)}... | ${b.status} | ${b.createdAt}`);
    });
  }
}

async function getLogs(projectId, serviceId) {
  console.log(`\n--- 📜 RECENT LOGS: ${serviceId} ---`);
  const logs = await nfRequest(`/projects/${projectId}/services/${serviceId}/logs`);
  if (logs?.data?.logs) {
    logs.data.logs.slice(-20).forEach(l => console.log(`[${l.timestamp.split('T')[1].split('.')[0]}] ${l.message}`));
  }
}

async function triggerBuild(projectId, serviceId) {
  console.log(`\n🚀 Triggering NEW BUILD/DEPLOY for ${serviceId}...`);
  const response = await nfRequest(`/projects/${projectId}/services/${serviceId}/build`, 'POST');
  if (response?.data) {
    console.log(`✅ Success! New Build ID: ${response.data.id}`);
  } else {
    console.error('❌ Error:', response.error);
  }
}

const [,, command, arg1, arg2] = process.argv;
(async () => {
    const pid = arg1 || 'mexc2026';
    const sid = arg2 || 'mexc-trading-bot';

    switch (command) {
        case 'list-projects': await listProjects(); break;
        case 'list-services': await listServices(pid); break;
        case 'status': await getStatus(pid, sid); break;
        case 'logs': await getLogs(pid, sid); break;
        case 'deploy': await triggerBuild(pid, sid); break;
        default:
            console.log(`
Available commands:
  status   (Default: mexc2026/mexc-trading-bot)
  logs     (Recent runtime logs)
  deploy   (Trigger build & deploy)
  list-projects
  list-services <projectId>
            `);
    }
})();
