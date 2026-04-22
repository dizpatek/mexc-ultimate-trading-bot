import { fetchAiAnalysis } from "../src/lib/ai-provider";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  console.log("🚀 Gemma 4 (LM Studio) Bağlantı Testi Başlatılıyor...");
  console.log(`📡 Endpoint: ${process.env.LOCAL_AI_API_URL}`);
  console.log(`🤖 Model: ${process.env.LOCAL_AI_MODEL}`);

  try {
    const response = await fetchAiAnalysis("Merhaba Gemma 4! Ben MexCBrain. Bağlantımız başarılı mı? Kısa bir cevap ver.", {
      systemPrompt: "Sen MexCBrain projesinin asistanısın.",
      temperature: 0.7,
      jsonMode: false
    });

    console.log("\n✅ BAĞLANTI BAŞARILI!");
    console.log("🤖 Gemma 4 Yanıtı:");
    console.log("-----------------------------------------");
    console.log(response);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("\n❌ BAĞLANTI HATASI!");
    console.error("Hata Detayı:", error);
  }
}

testConnection();
