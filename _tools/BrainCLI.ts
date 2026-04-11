import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const args = process.argv.slice(2);
const helpText = `
🧠 MexCBrain Master CLI Toolkit

Kullanım: npm run tool <kategori>:<script_adi>

Kategoriler:
    db       Veritabanı yönetimi (Örn: db:clear-db, db:diag_db)
    api      API ve Portföy testleri (Örn: api:test-api, api:check-holdings)
    system   Sistem, log, ve audit araçları (Örn: system:health-check, system:master_system_audit)

"npm run tool list" yazarak tüm mevcut araçları görebilirsiniz.
`;

const toolsDir = path.join(process.cwd(), '_tools');

function listTools() {
    console.log("🛠️  MEVCUT ARAÇLAR (Available Scripts):\n");
    const categories = ['db', 'api', 'system'];
    for (const cat of categories) {
        const catPath = path.join(toolsDir, cat);
        if (fs.existsSync(catPath)) {
            console.log(`📂 [${cat.toUpperCase()}]`);
            const files = fs.readdirSync(catPath).filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.mjs'));
            files.forEach(f => {
                const name = f.replace(/\.(ts|js|mjs)$/, '');
                console.log(`   - npm run tool ${cat}:${name}`);
            });
            console.log("");
        }
    }
}

function runScript(command: string) {
    if (!command || command === 'list' || command === 'help') {
        if (!command || command === 'help') console.log(helpText);
        listTools();
        process.exit(0);
    }

    const [category, script] = command.split(':');
    if (!category || !script) {
        console.error(`❌ Geçersiz komut formatı: ${command}`);
        console.log("Beklenen format: <kategori>:<script_adi> (Örn: db:diag_db)");
        process.exit(1);
    }

    const exts = ['.ts', '.js', '.mjs', '.ps1'];
    let scriptFile = '';
    for (const ext of exts) {
        const p = path.join(toolsDir, category, script + ext);
        if (fs.existsSync(p)) {
            scriptFile = p;
            break;
        }
    }

    if (!scriptFile) {
        console.error(`❌ Script bulunamadı: _tools/${category}/${script}`);
        console.log("Yardım için 'npm run tool list' komutunu kullanın.");
        process.exit(1);
    }

    console.log(`🚀 BAŞLIYOR: ${category}:${script}...\n`);
    try {
        if (scriptFile.endsWith('.ts')) {
            execSync(`npx tsx "${scriptFile}"`, { stdio: 'inherit' });
        } else if(scriptFile.endsWith('.ps1')) {
            execSync(`powershell.exe -ExecutionPolicy Bypass -File "${scriptFile}"`, { stdio: 'inherit' });
        } else {
            execSync(`node "${scriptFile}"`, { stdio: 'inherit' });
        }
    } catch (e: any) {
        console.error(`\n❌ ${script} çalıştırılırken hata oluştu.`);
        process.exit(e.status || 1);
    }
}

runScript(args[0]);
