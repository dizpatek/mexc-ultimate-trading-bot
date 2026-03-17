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
  update-env <projectId> <serviceId>
      `);
      break;
  }
})();
