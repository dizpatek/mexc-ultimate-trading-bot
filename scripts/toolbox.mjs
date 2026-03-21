
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// SSL ve diğer Node.js uyarılarını terminalde gizle
process.env.NODE_NO_WARNINGS = '1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const backupDir = path.join(rootDir, 'scripts', 'toolbox');

/**
 * 🛠️ AKILLI ARAÇ SETİ (VIRTUAL TOOLBOX)
 * Bu script, yedek dizindeki araçları root dizinde geçici olarak oluşturup çalıştırarak 
 * dosya içindeki rölatif yolların ve importların bozulmasını engeller.
 */

function getAvailableTools() {
  if (!fs.existsSync(backupDir)) return [];
  
  return fs.readdirSync(backupDir)
    .filter(file => (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.mjs')) 
           && !file.includes('config') 
           && !file.startsWith('toolbox_temp_')) // Kendi geçici dosyalarını listeleme
    .map(file => ({
      name: file.replace(/(_|\.)/g, ' ').replace(/(js|ts|mjs)$/, '').trim().toUpperCase(),
      file: file,
      path: path.join(backupDir, file)
    }));
}

const tools = getAvailableTools();

console.log('\n--- 🛠️ MATRIX ULTIMATE VIRTUAL TOOLBOX ---');
console.log(`Kaynak: ${backupDir}`);

const arg = process.argv[2];

if (!arg) {
  console.log('Kullanım: node scripts/toolbox.mjs <aramaterimi>\n');
  console.log('Mevcut Araçlar:');
  if (tools.length === 0) {
    console.log(' (Yedek dizininde henüz araç bulunamadı)');
  } else {
    tools.forEach((t, i) => {
      process.stdout.write(`${(i + 1).toString().padStart(3)}. ${t.name.padEnd(25)} `);
      if ((i + 1) % 2 === 0) process.stdout.write('\n');
    });
    console.log('\n');
  }
  process.exit();
}

const tool = tools.find(t => 
  t.file.toLowerCase().includes(arg.toLowerCase()) || 
  t.name.toLowerCase().includes(arg.toLowerCase())
);

if (!tool) {
  console.error(`❌ Hata: "${arg}" ile eşleşen bir araç bulunamadı.`);
  process.exit(1);
}

// Geçici dosya ismini daha güvenli yapalım (Boşlukları temizle)
const safeFileName = tool.file.replace(/\s+/g, '_');
const tempPath = path.join(rootDir, `toolbox_temp_${safeFileName}`);

console.log(`🚀 BAŞLATILIYOR: ${tool.name}`);
console.log(`📦 Sanal Katman: ${tool.file} hazırlık...`);

try {
  // 1. Dosyayı oku ve yolları root'a göre uyarla
  let content = fs.readFileSync(tool.path, 'utf8');
  
  // '../../src/lib/' gibi yolları './src/lib/' olarak değiştir ki root'ta çalışabilsin
  content = content.replace(/from\s+['"]\.\.\/\.\.\/src\//g, "from './src/");
  
  fs.writeFileSync(tempPath, content);

  // 2. Çalıştır
  // --no-warnings bayrağını da ekleyelim. Proxy additional args.
  const extraArgs = process.argv.slice(3).join(' ');
  const cmd = `npx tsx --no-warnings --env-file=.env.local ${tempPath} ${extraArgs}`;
  
  execSync(cmd, { 
    stdio: 'inherit', 
    cwd: rootDir,
    env: { ...process.env, NODE_NO_WARNINGS: '1' } 
  });
  
  console.log('\n✅ İşlem başarıyla tamamlandı.');
} catch (e) {
  console.log(`\n❌ ARAÇ HATASI: ${tool.name} çalışırken bir sorunla karşılaştı.`);
  console.log(`💡 Detay: ${e?.message || e || 'Bilinmeyen hata'}`);
} finally {
  // 3. Geçici dosyayı her durumda sil
  if (fs.existsSync(tempPath)) {
    try {
       fs.unlinkSync(tempPath);
     } catch {
       // Sessizce geç
    }
  }
}
