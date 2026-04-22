import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATASET_PATH = path.resolve(process.cwd(), '..', 'AutoResearch', 'instruction_dataset.md');

const NICHES = [
    {
        name: "PineScript Advanced Master",
        prompt: "TradingView PineScript V5 programlama dilinde dunya capinda bir uzmansin. Kompleks indikatorler, backtest motorlari ve strateji optimizasyonu konularinda cok derin teknik bilgiler ver."
    },
    {
        name: "On-chain & Whale Analyst",
        prompt: "On-chain verileri, borsa giris-cikis akislari ve buyuk balina hareketlerini yorumlayan bir uzmansin. Akilli para (Smart Money) takibi ve likidite haritalari konusuna odaklan."
    },
    {
        name: "Market Maker & Arbitrage Specialist",
        prompt: "Market maker algoritmaları, emir defteri analizi, spread yonetimi ve borsalar arasi arbitraj konularinda matematiksel ve teknik derinligi olan bir uzmansin."
    },
    {
        name: "Crypto Macro & News Strategist",
        prompt: "Global makroekonomik verilerin (FED kararlari, enflasyon, faiz) kripto paralar uzerindeki etkilerini ve haber bazli sinyal olusumlarini yorumlayan bir uzmansin."
    },
    {
        name: "Python & TypeScript Trading Bot Developer",
        prompt: "MexC ve Binance API'lerini kullanarak yüksek performansli trading botlari gelistiren, hata onaran ve optimizasyon yapan bir yazilim mimarisin."
    }
];

async function generateHarvesterDataset() {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY .env.local icinde bulunamadi.");
    return;
  }
  
  const isGroq = apiKey.startsWith("gsk_");
  const apiUrl = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4-turbo";

  console.log("🚀 DEVAZA BILGI HASADI BASLIYOR (24H Maratonu Hazirlik)...");

  for (const niche of NICHES) {
    console.log(`\n📂 Segment: ${niche.name} işleniyor...`);
    
    const prompt = `Sen ${niche.prompt}
Adın "MexCBrain". 
Gorevin: Bana formatı aşağıdaki gibi olan 15 adet mükemmel, zengin, teknik derinliği yüksek ve uzun soru-cevap ikilisi (QA) türetmek. 
Cevaplarin basit olmasin, gercek dunya tecrubesi ve ileri duzey trading taktikleri icersin.

Format şu olmalıdır (Tam olarak markdown formati):
<|user|>
[Kullanıcı Sorusu]
<|ai|>
[MexCBrain Cevabı]<|end|>

Lutfen JSON DEGIL, sadece yukaridaki formatta sirayla 15 tane soru-cevap dondur. Markdown formatina sadik kal.`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8
        })
      });

      if (!response.ok) {
          console.error(`❌ HTTP Hatası (${niche.name}):`, await response.text());
          continue;
      }

      const data = await response.json();
      const generatedText = data.choices[0].message.content;

      fs.appendFileSync(DATASET_PATH, "\n" + generatedText + "\n", 'utf-8');
      console.log(`✅ ${niche.name} icin 15 adet uzman QA eklendi.`);
      
      // Rate limit korumasi icin kısa bekleyiş
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      console.error(`❌ Hata (${niche.name}):`, err);
    }
  }
  console.log("\n🏁 BILGI HASADI TAMAMLANDI. Veri seti devasa boyuta ulastı.");
}

generateHarvesterDataset();
