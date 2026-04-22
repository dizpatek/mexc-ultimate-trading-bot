import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fetchAiAnalysis } from "../../src/lib/ai-provider";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const WIKI_DIR = path.join(process.cwd(), "brain", "wiki");
const LOG_FILE = path.join(WIKI_DIR, "00-LOG.md");
const NEW_STRAT_DIR = path.join(process.cwd(), "_tools", "new_strategies");
const INSTRUCTION_DATASET_PATH = path.resolve(process.cwd(), "..", "AutoResearch", "instruction_dataset.md");

if (!fs.existsSync(NEW_STRAT_DIR)) {
  fs.mkdirSync(NEW_STRAT_DIR, { recursive: true });
}

/**
 * 🤖 AutoDeveloper Agent (Self-Coding Module)
 * Merkezi AI Sağlayıcısını (LM Studio / Groq) kullanarak kendi stratejilerini 
 * ve PineScript kodlarını otonom olarak yazar.
 */
async function callExternalBrain(prompt: string): Promise<string> {
  const systemPrompt = `
Sen MexCBrain projesinin 'Agent-Developer' isimli otonom kod yazarı modülüsün. 
PineScript (TradingView) ve TypeScript konularında uzmansın. 
Senden sadece geçerli ve parse edilebilir bir JSON objesi dönmen bekleniyor. 
Format: { "filename": "deneme.pine", "code": "// kod burada", "explanation": "aciklama" }. 
KESİNLİKLE JSON içinde \`\`\`pine veya triple quote (""") kullanma. 
Tüm kodu standart \\n ile kaçış dizisi yaparak tek bir string olarak yaz.
  `.trim();

  const response = await fetchAiAnalysis(prompt, {
    systemPrompt,
    temperature: 0.2, // Kod yazımı için daha deterministik
    jsonMode: true
  });

  // fetchAiAnalysis zaten JSON parse ediyor, biz string bekliyoruz (mevcut akış için)
  return typeof response === 'string' ? response : JSON.stringify(response);
}

export async function runAutoDeveloperCycle() {
  console.log("======================================================");
  console.log("🚀 EXPLORER AGENT: Otonom Kodlama ve Strateji Üretimi");
  console.log("======================================================");

  try {
    // 1. RLAIF verilerinden son hatayı veya ilham kaynağını al
    let problemContext = "Son zamanlarda yatay piyasada çok fazla fake (sahte) kırılıma girdik. Hacim onaylı trend takip eden bir yapı lazım.";
    
    if (fs.existsSync(INSTRUCTION_DATASET_PATH)) {
      const instructions = fs.readFileSync(INSTRUCTION_DATASET_PATH, 'utf-8');
      const lines = instructions.split('\n');
      const recent = lines.slice(-20).join('\n');
      if (recent.length > 50) {
        problemContext += `\n\nAyrıca şu anki RLAIF (Kendi Hatalarımız) Logları:\n${recent}`;
      }
    }

    console.log("🔍 Zayıf Noktalar ve RLAIF (Hata) Kayıtları Analiz Ediliyor...");
    
    // 2. Harici Yapay Zekadan bu problemi çözecek bir Kod üretmesini iste
    const prompt = `Görevin: Yeni bir PineScript v5 Göstergesi (Indicator) veya Stratejisi kodlamak. 
Mevcut sorun: ${problemContext}
Lütfen momentum kayıplarını engelleyen, Karpathy otonom döngüsüyle TSL/Take-Profit oranları adapte edilebilecek sağlam bir 'Machine Learning' PineScript stratejisi yaz. Karar mekanizmalarını net belirt. Sonucu JSON formatında ver.`;

    console.log("🧠 Merkezi AI Sağlayıcısına İstek Gönderiliyor. Lütfen bekleyin...");
    const jsonStr = await callExternalBrain(prompt);
    
    const result = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    
    if (result.filename && result.code) {
      const targetPath = path.join(NEW_STRAT_DIR, result.filename);
      fs.writeFileSync(targetPath, result.code, "utf-8");
      
      console.log(`\n======================================================`);
      console.log(`✅ OTONOM KODLAMA BAŞARILI!`);
      console.log(`📄 Dosya: ${result.filename}`);
      console.log(`📂 Dizin: _tools/new_strategies/`);
      console.log(`💡 Açıklama: ${result.explanation}`);
      console.log(`======================================================\n`);

      // 3. Log'u güncelle
      const today = new Date().toISOString().split("T")[0];
      const logEntry = `\n## [${today}] agent-developer | Otonom PineScript Stratejisi Yazıldı\n\n- **Dosya:** ${result.filename}\n- **Neden:** RLAIF Hata analizinden yola çıkılarak geliştirildi.\n- **Açıklama:** ${result.explanation}\n`;
      fs.appendFileSync(LOG_FILE, logEntry);
      console.log("📝 Wiki Güncellendi.");
      
      return targetPath;
    } else {
      console.error("❌ Ajan beklenmeyen bir formda cevap döndü:", result);
    }
  } catch (err) {
    console.error("❌ AutoDeveloper Hatası:", err);
  } finally {
     console.log("======================================================\n");
  }
}

// Standalone test için
if (require.main === module) {
  runAutoDeveloperCycle().catch(console.error).finally(() => process.exit(0));
}

