import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolboxDir = path.join(__dirname, 'toolbox');
const rootDir = path.resolve(__dirname, '../');

function getAvailableTools() {
  if (!fs.existsSync(toolboxDir)) return [];

  return fs.readdirSync(toolboxDir)
    .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && file.startsWith('master_'))
    .map(file => {
      const name = file
        .replace(/^master_/, '')
        .replace(/\.(ts|js)$/, '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        name,
        file,
        path: path.join(toolboxDir, file),
      };
    });
}

function runTool(toolPath: string) {
  console.log(`\n🚀 BAŞLATILIYOR: ${path.basename(toolPath)}...`);
  try {
    const cmd = `npx tsx --no-warnings --env-file=.env.local ${toolPath}`;
    execSync(cmd, {
      stdio: 'inherit',
      cwd: rootDir,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    console.log('\n✅ İşlem başarıyla tamamlandı.');
  } catch (e: any) {
    console.log(`\n❌ ARAÇ HATASI: Çalışırken bir sorunla karşılaştı.`);
    console.log(`💡 Detay: ${e?.message || e || 'Bilinmeyen hata'}`);
  }
}

function showInteractiveMenu() {
  const tools = getAvailableTools();

  if (tools.length === 0) {
    console.log('⚠️  Toolbox klasöründe araç (master_*.ts) bulunamadı.');
    return;
  }

  console.log('\n======================================================');
  console.log(' 🛠️   MEXC ULTIMATE TOOLSET (INTERACTIVE CLI)');
  console.log('======================================================\n');

  tools.forEach((t, i) => {
    console.log(`  [${(i + 1).toString().padStart(2)}] 🚀 ${t.name.padEnd(25)} (${t.file})`);
  });
  console.log(`  [ 0] ❌ Çıkış`);

  console.log('\n------------------------------------------------------');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('👉 Çalıştırmak istediğiniz aracın numarasını girin: ', (answer) => {
    const choice = parseInt(answer.trim(), 10);

    if (isNaN(choice) || choice < 0 || choice > tools.length) {
      console.log('❌ Geçersiz seçim. Lütfen tekrar deneyin.\n');
      rl.close();
      showInteractiveMenu(); 
    } else if (choice === 0) {
      console.log('Programdan çıkılıyor. İyi günler!\n');
      rl.close();
      process.exit(0);
    } else {
      const selectedTool = tools[choice - 1];
      rl.close();
      runTool(selectedTool.path);
    }
  });
}

const arg = process.argv[2];

if (arg) {
  const tools = getAvailableTools();
  const tool = tools.find(
    (t) =>
      t.file.toLowerCase().includes(arg.toLowerCase()) ||
      t.name.toLowerCase().includes(arg.toLowerCase())
  );

  if (tool) {
    runTool(tool.path);
  } else {
    console.error(`❌ Hata: "${arg}" ile eşleşen bir araç bulunamadı.`);
    process.exit(1);
  }
} else {
  showInteractiveMenu();
}
