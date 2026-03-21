import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const NF_API_TOKEN = process.env.NF_API_TOKEN;
const BASE_URL = 'https://api.northflank.com/v1';

if (!NF_API_TOKEN) {
  console.error('Error: NF_API_TOKEN is not set in .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${NF_API_TOKEN}`,
  'Content-Type': 'application/json'
};

async function nfRequest(endpoint, method = 'GET', body = null) {
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || response.statusText);
    }
    return data;
  } catch (error) {
    console.error(`Request failed (${endpoint}):`, error.message);
    return null;
  }
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

async function updateEnv(projectId, serviceId, variables) {
  console.log(`\nUpdating environment for ${serviceId}...`);
  const data = await nfRequest(`/projects/${projectId}/services/${serviceId}/runtime-environment`, 'POST', {
    runtimeEnvironment: variables
  });
  if (data?.data?.success) {
    console.log('✅ Environment updated successfully!');
    if (data.data.restartSuccessful) {
      console.log('🔄 Service restart triggered.');
    }
  }
}

async function getStatus(projectId, serviceId) {
  console.log(`\n--- 🛡️ NORTHFLANK STATUS: ${projectId} / ${serviceId} ---`);
  
  // 1. Service Details & Integrated Status
  const service = await nfRequest(`/projects/${projectId}/services/${serviceId}`);
  if (service?.data) {
    const s = service.data;
    console.log(`📡 Service: ${s.name} (Type: ${s.serviceType})`);
    
    if (s.status) {
      const buildSt = s.status.build || {};
      const deploySt = s.status.deployment || {};
      console.log(`\n🏗️ Build Status: ${buildSt.status || 'N/A'}`);
      console.log(`🚀 Deploy Status: ${deploySt.status || 'N/A'}`);
      if (deploySt.activeRelease) {
          console.log(`📌 Active Release ID: ${deploySt.activeRelease.id}`);
      }
    }
  } else {
    console.error('❌ Service not found or API error.');
    return;
  }

  // 2. Build History (Singular 'build' endpoint for service-specific builds)
  const buildData = await nfRequest(`/projects/${projectId}/services/${serviceId}/build`);
  if (buildData?.data?.builds) {
    const buildList = buildData.data.builds.slice(0, 5);
    console.log(`\n🐳 Recent Builds:`);
    buildList.forEach(b => {
      const statusIcon = b.status === 'success' ? '✅' : b.status === 'failed' ? '❌' : '⏳';
      console.log(`   - ${statusIcon} ${b.id.slice(0,8)}... | Status: ${b.status} | Created: ${b.createdAt} | Branch: ${b.branch || 'main'}`);
    });
  }

  // 3. Deployment History (Singular 'deployment' endpoint)
  const deployData = await nfRequest(`/projects/${projectId}/services/${serviceId}/deployment`);
  if (deployData?.data?.deployments) {
    const depList = deployData.data.deployments.slice(0, 3);
    console.log(`\n📦 Recent Deployments:`);
    depList.forEach(d => console.log(`   - ID: ${d.id.slice(0, 8)}... | Status: ${d.status} | Created: ${d.createdAt}`));
  }
}

async function getLogs(projectId, serviceId) {
  console.log(`\n--- 📜 RECENT LOGS: ${serviceId} ---`);
  const logs = await nfRequest(`/projects/${projectId}/services/${serviceId}/logs`);
  if (logs?.data?.logs) {
    logs.data.logs.slice(-20).forEach(log => {
      console.log(`[${log.timestamp.split('T')[1].split('.')[0]}] ${log.message}`);
    });
  } else {
    console.error('❌ Could not fetch logs:', logs?.error || 'No logs available');
  }
}

async function triggerBuild(projectId, serviceId) {
  console.log(`\n🚀 Triggering NEW BUILD for ${serviceId}...`);
  const response = await nfRequest(`/projects/${projectId}/services/${serviceId}/build`, 'POST');
  if (response?.data) {
    console.log('✅ Build triggered successfully!');
    console.log(`📡 New Build ID: ${response.data.id}`);
  } else {
    console.error('❌ Failed to trigger build:', response?.error || 'Unknown Error');
  }
}

// Simple CLI handling
const [,, command, arg1, arg2] = process.argv;

(async () => {
  switch (command) {
    case 'list-projects':
      await listProjects();
      break;
    case 'list-services':
      if (!arg1) return console.log('Usage: node deploy.mjs list-services <projectId>');
      await listServices(arg1);
      break;
    case 'status':
      if (!arg1 || !arg2) return console.log('Usage: node deploy.mjs status <projectId> <serviceId>');
      await getStatus(arg1, arg2);
      break;
    case 'logs':
      if (!arg1 || !arg2) return console.log('Usage: node deploy.mjs logs <projectId> <serviceId>');
      await getLogs(arg1, arg2);
      break;
    case 'deploy-now':
      if (!arg1 || !arg2) return console.log('Usage: node deploy.mjs deploy-now <projectId> <serviceId>');
      await triggerBuild(arg1, arg2);
      break;
    case 'update-env':
      if (!arg1 || !arg2) return console.log('Usage: node deploy.mjs update-env <projectId> <serviceId>');
      
      const envVars = {
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        CRYPTOCOMPARE_API_KEY: process.env.CRYPTOCOMPARE_API_KEY,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
      };

      if (!envVars.GROQ_API_KEY) {
        return console.error('Error: GROQ_API_KEY is not set in .env');
      }

      await updateEnv(arg1, arg2, envVars);
      break;
    default:
      console.log(`
Northflank Deploy Utility
-------------------------
Available commands:
  list-projects
  list-services <projectId>
  status <projectId> <serviceId>
  deploy-now <projectId> <serviceId>
  logs <projectId> <serviceId>
  update-env <projectId> <serviceId>
      `);
      break;
  }
})();
