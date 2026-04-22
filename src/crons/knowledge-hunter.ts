import fs from "fs";
import path from "path";

// The directory where we store raw academic knowledge and trading strategy rules
const KNOWLEDGE_DIR = path.resolve(process.cwd(), "_tools", "knowledge_base");

// Ensure knowledge directory exists
if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

interface ArxivEntry {
  id: string;
  updated: string;
  published: string;
  title: string;
  summary: string;
  author: string;
}

/**
 * Parses incredibly simple arXiv XML atom feed without heavy dependencies.
 */
function parseArxivXML(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryMatches = xml.split("<entry>");
  
  // Skip the first block before the first <entry>
  for (let i = 1; i < entryMatches.length; i++) {
    const entryBlock = entryMatches[i];
    
    const idMatch = entryBlock.match(/<id>(.*?)<\/id>/);
    const updatedMatch = entryBlock.match(/<updated>(.*?)<\/updated>/);
    const publishedMatch = entryBlock.match(/<published>(.*?)<\/published>/);
    const titleMatch = entryBlock.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entryBlock.match(/<summary>([\s\S]*?)<\/summary>/);
    
    if (idMatch && titleMatch && summaryMatch) {
      entries.push({
        id: idMatch[1].trim(),
        updated: updatedMatch ? updatedMatch[1].trim() : "",
        published: publishedMatch ? publishedMatch[1].trim() : "",
        title: titleMatch[1].trim().replace(/\n/g, " "),
        summary: summaryMatch[1].trim(),
        author: "arXiv API"
      });
    }
  }
  
  return entries;
}

/**
 * Searches ArXiv API for specific quantitative finance and algorithmic trading papers
 */
async function huntArxivKnowledge() {
  const queries = [
    "algorithmic trading",
    "cryptocurrency prediction",
    "quantitative finance",
    "trailing stop loss optimization",
    "time series forecasting momentum"
  ];
  
  // Select a random query to keep the knowledge stream fresh and varied every run
  const randomQuery = queries[Math.floor(Math.random() * queries.length)];
  // Replace spaces with + for the query
  const queryWords = randomQuery.split(" ").join("+");
  const searchQuery = `all:%22${queryWords}%22`;
  
  console.log(`[Knowledge Hunter] 🧠 Hunting ArXiv for: ${randomQuery}...`);
  
  try {
    // max_results=5 to prevent spamming and keep only top relevance per run
    const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ArXiv API Error: ${res.statusText}`);
    
    const xml = await res.text();
    const entries = parseArxivXML(xml);
    
    console.log(`[Knowledge Hunter] 📥 Found ${entries.length} recent papers.`);
    
    let newPapersCount = 0;
    for (const entry of entries) {
      // ArXiv IDs are usually URLs: http://arxiv.org/abs/2103.12345
      const arxivId = entry.id.split('/').pop() || "unknown";
      const fileName = `arxiv_${arxivId.replace(/\./g, "_")}.md`;
      const filePath = path.join(KNOWLEDGE_DIR, fileName);
      
      // If we already ingested this, skip
      if (!fs.existsSync(filePath)) {
        const mdContent = `---
type: academic-paper
source: ${entry.id}
title: "${entry.title}"
published: ${entry.published}
tags: [trading, finance, research, arxiv]
---

# ${entry.title}

## Yazar / Kaynak
${entry.author} - ArXiv

## Özet / Çıkarım (Abstract)
${entry.summary}

> **Yapay Zeka Core Direktifi:** Bu makaledeki teknik analiz ve makine öğrenmesi mantıklarını, f4 indikatörünün slope hesaplamalarında ve risk yönetimi (TSL/TTP) mekanizmalarında deneysel fikir (hypothesis) oluşturmak için kullan.
`;
        fs.writeFileSync(filePath, mdContent, "utf-8");
        newPapersCount++;
      }
    }
    
    console.log(`[Knowledge Hunter] ✅ Saved ${newPapersCount} NEW academic insights to knowledge base.`);
  } catch (err) {
    console.error(`[Knowledge Hunter] ❌ ArXiv scrap failed:`, err);
  }
}

/**
 * Main execution
 */
export async function runKnowledgeHunter() {
  console.log('\n======================================================');
  console.log('🤖 MEXCBRAIN KNOWLEDGE HUNTER INIT');
  console.log('======================================================');
  
  await huntArxivKnowledge();
  // Here we can later add: huntMediumArticles(), huntPineScriptDocs(), etc.
  
  console.log('======================================================\n');
}

// Allow running as a standalone script
if (require.main === module) {
  runKnowledgeHunter().catch(console.error);
}
