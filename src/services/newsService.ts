import axios from 'axios';

export interface CryptoCompareArticle {
    id: string;
    title: string;
    body: string;
    source_info: { name: string };
    published_on: number;
    url: string;
    imageurl: string;
}

export interface ProcessedNewsItem {
    id: string;
    title: string;
    translatedTitle: string;
    excerpt: string;
    source: string;
    time: string;
    url: string;
    imageUrl: string;
    publishedOn: number;
}

// In-memory persistent cache for translations
const translationDict = new Map<string, string>();

async function translateToTurkish(text: string): Promise<string> {
    if (translationDict.has(text)) {
        return translationDict.get(text) as string;
    }

    try {
        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(text)}`);
        if (res.data && res.data[0] && res.data[0][0]) {
            const translated = res.data[0][0][0];
            
            if (translationDict.size >= 1000) {
                translationDict.clear();
            }
            
            translationDict.set(text, translated);
            return translated;
        }
        return text;
    } catch (e) {
        console.warn('Translation error:', e);
        return text;
    }
}

export async function fetchAndProcessNews(): Promise<ProcessedNewsItem[]> {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');

    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 86400; // 24 hours ago
    
    const rawNews: CryptoCompareArticle[] = response.data.Data
        .filter((a: CryptoCompareArticle) => a.published_on > cutoff)
        .slice(0, 25);
    
    // Process with limited concurrency (in batches of 5) to balance speed and avoid API bans
    const news: ProcessedNewsItem[] = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < rawNews.length; i += BATCH_SIZE) {
        const batch = rawNews.slice(i, i + BATCH_SIZE);
        const translatedBatch = await Promise.all(batch.map(async (article) => {
            const translatedTitle = await translateToTurkish(article.title);
            return {
                id: article.id,
                title: article.title,
                translatedTitle: translatedTitle,
                excerpt: article.body.length > 150 ? article.body.substring(0, 150) + '...' : article.body,
                source: article.source_info.name,
                time: new Date(article.published_on * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                url: article.url,
                imageUrl: article.imageurl,
                publishedOn: article.published_on
            };
        }));
        news.push(...translatedBatch);
    }

    return news;
}
