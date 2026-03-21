import fs from 'fs';
import path from 'path';

/**
 * 🚀 MASTER DEPLOYMENT HUB
 * Northflank yapılandırmalarını ve dağıtım (deployment) dosyalarını denetler.
 */

async function deploymentHub() {
  console.log(`\n--- 🚀 MASTER DEPLOYMENT HUB: ALTYAPI VE DAĞITIM DENETİMİ ---`);
  const startTime = Date.now();

  const configs = [
    'nf-service.json',
    'nf-addon.json',
    'nf-init-job.json',
    'nf-build-options.json'
  ];

  try {
    // 1. JSON Yapılandırma Kontrolü
    console.log(`\n📦 NORTHFLANK YAPILANDIRMASI:`);
    for (const file of configs) {
      const filePath = path.resolve('scripts', file);
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`   - ${file.padEnd(25)}: ✅ OK (Name: ${content.name || 'N/A'})`);
      } else {
        console.log(`   - ${file.padEnd(25)}: ❌ EKSİK`);
      }
    }

    // 2. Dockerfile Kontrolü
    console.log(`\n🐳 DOCKER DURUMU:`);
    const dockerPath = path.resolve('Dockerfile');
    if (fs.existsSync(dockerPath)) {
      console.log(`   - Dockerfile              : ✅ MEVCUT`);
    } else {
      console.log(`   - Dockerfile              : ❌ EKSİK (Deployment için gerekli!)`);
    }

    // 3. Environment Kontrolü (.env.local)
    console.log(`\n🔐 ÇEVRE DEĞİŞKENLERİ:`);
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
      console.log(`   - .env.local              : ✅ MEVCUT (Local dev hazır)`);
    } else {
      console.log(`   - .env.local              : ⚠️ EKSİK (.env kullanılıyor olabilir)`);
    }

    console.log(`\n✨ Dağıtım denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ DEPLOYMENT HUB HATASI:`, err);
  }
}

deploymentHub();
