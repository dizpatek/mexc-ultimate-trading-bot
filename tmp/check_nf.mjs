import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'scripts', 'northflank-deploy', '.env') });

const NF_API_TOKEN = process.env.NF_API_TOKEN;
const BASE_URL = 'https://api.northflank.com/v1';

async function nfRequest(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${NF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return await response.json();
}

async function checkStatus() {
  console.log('--- MEXC2026 SERVICE DEBUG ---');
  const service = await nfRequest('/projects/mexc2026/services/mexc-trading-bot');
  console.log('Service Info:', JSON.stringify(service.data, null, 2));
  
  const builds = await nfRequest('/projects/mexc2026/builds');
  console.log('Overall Builds:', JSON.stringify(builds, null, 2));

  const deployments = await nfRequest('/projects/mexc2026/services/mexc-trading-bot/deployments');
  console.log('Deployments:', JSON.stringify(deployments, null, 2));
}

checkStatus();
