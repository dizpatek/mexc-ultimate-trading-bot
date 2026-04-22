import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fetchAiAnalysis } from '../../src/lib/ai-provider';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATASET_PATH = path.resolve(process.cwd(), '..', 'AutoResearch', 'instruction_dataset.md');

/**
 * 🎲 Dataset Generator AI Hub
 * Gemma 4 (veya seçili AI) üzerinden yerel model için eğitim verisi sentezler.
 */
async function generateExpertDataset() {
  const topicsStr = process.env.TRAINING_TOPICS || "kripto_bot,pine_script,risk_yonetimi";
  const selectedTopics = topicsStr.split(",");

  console.log(`🤖 AI Hub'a Bağlanılıyor... [${selectedTopics.length}] konu için uzman verisi sentezleniyor.`);
  console.log(`📡 Hedef Konular: ${topicsStr}`);

  const systemPrompt = `
Sen dunya capinda bir Kripto Bot algoritmaları, Trading View PineScript, bot kurulum, kullanim, onarma ve gelistirme uzmanisin. 
Adın "MexCBrain". Görevin, yerel bir asistan modelin eğitimi için yüksek kaliteli Soru-Cevap (QA) verisi üretmek.
  `.trim();

  const userPrompt = `
Görevin: Aşağıdaki konuları kapsayan, 20 adet mükemmel, zengin ve uzun soru-cevap ikilisi (QA) türetmek. 
KONULAR: ${topicsStr}

Sorular kullanıcının bot onarımı, kripto taktikleri, senin kim olduğun, nasıl daha iyi kâr edileceği gibi şeyleri kapsamalı.

Format şu olmalıdır (Tam olarak markdown formati):
<|user|>
[Kullanıcı Sorusu]
<|ai|>
[MexCBrain Cevabı]<|end|>

Lutfen JSON DEGIL, sadece yukaridaki formatta sirayla 20 tane soru-cevap dondur. 
Cok mantikli ve egitici cevaplar ver. Temiz Turkce kullan.
  `.trim();

  try {
    const generatedText = await fetchAiAnalysis(userPrompt, {
      systemPrompt,
      temperature: 0.8, // Daha yaratıcı QA türetimi için
      jsonMode: false   // Ham metin (markdown) istiyoruz
    });

    if (!generatedText || typeof generatedText !== 'string') {
        throw new Error("AI geçerli bir metin üretmedi.");
    }

    // Append to file
    fs.appendFileSync(DATASET_PATH, "\n" + generatedText + "\n", 'utf-8');
    console.log(`✅ Basariyla ${DATASET_PATH} dosyasina [${selectedTopics.length}] konu için yeni egitim verisi eklendi!`);
  } catch (err) {
    console.error("❌ Hata:", err);
  }
}

generateExpertDataset();
