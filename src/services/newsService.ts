import axios from "axios";
import https from "https";

// CryptoCompare API Response Types
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

// Helper to get HTTPS agent safely for server environments
const getHttpsAgent = () => {
  if (typeof window === "undefined") {
    // P3.1: Enforce TLS verification.
    // If local environment fails with CRYPT_E_NO_REVOCATION_CHECK,
    // it should be fixed at OS/Network level instead of application code.
    return new https.Agent({ keepAlive: true });
  }
  return undefined;
};

async function translateToTurkish(text: string): Promise<string> {
  if (translationDict.has(text)) {
    return translationDict.get(text) as string;
  }

  try {
    const httpsAgent = getHttpsAgent();
    const res = await axios.get(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(text)}`,
      {
        httpsAgent,
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    );

    if (res.data && res.data[0] && res.data[0][0]) {
      const translated = res.data[0][0][0];

      // P4.1: Better cache eviction (O(1) per item using iterators)
      if (translationDict.size >= 1000) {
        const iterator = translationDict.keys();
        for (let i = 0; i < 100; i++) {
          const { value, done } = iterator.next();
          if (done) break;
          translationDict.delete(value);
        }
      }

      translationDict.set(text, translated);
      return translated;
    }
    return text;
  } catch (e) {
    console.warn("Translation error:", e);
    return text;
  }
}

/**
 * P4.2: SRP - Separate fetching logic
 */
async function fetchRawNews(): Promise<CryptoCompareArticle[]> {
  const httpsAgent = getHttpsAgent();
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY || "";
  const authHeaders = apiKey ? { authorization: `Apikey ${apiKey}` } : {};
  
  const response = await axios.get(
    "https://min-api.cryptocompare.com/data/v2/news/?lang=EN",
    {
      httpsAgent,
      timeout: 10000,
      headers: {
        ...authHeaders,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    },
  );

  if (response.data?.Response === "Error") {
    console.warn("[NewsService] API Error:", response.data.Message);
    return [];
  }

  if (!response.data || !Array.isArray(response.data.Data)) {
    console.warn("[NewsService] Invalid news data received. Structure:", JSON.stringify(response.data)?.substring(0, 200));
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 86400; // 24 hours ago

  return response.data.Data.filter(
    (a: CryptoCompareArticle) => a.published_on > cutoff,
  ).slice(0, 25);
}

/**
 * Helper to process items in parallel with a concurrency limit
 */
async function processWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * P4.2: SRP - Separate processing logic
 */
async function processAndTranslateBatch(
  articles: CryptoCompareArticle[],
): Promise<ProcessedNewsItem[]> {
  return processWithLimit(articles, 5, async (article) => {
    const translatedTitle = await translateToTurkish(article.title);
    return {
      id: article.id,
      title: article.title,
      translatedTitle: translatedTitle,
      excerpt:
        article.body.length > 150
          ? article.body.substring(0, 150) + "..."
          : article.body,
      source: article.source_info.name,
      time: new Date(article.published_on * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      url: article.url,
      imageUrl: article.imageurl,
      publishedOn: article.published_on,
    };
  });
}

export async function fetchAndProcessNews(): Promise<ProcessedNewsItem[]> {
  try {
    console.log("[NewsService] Fetching raw news...");
    if (!process.env.CRYPTOCOMPARE_API_KEY) {
      console.warn("[NewsService] WARNING: CRYPTOCOMPARE_API_KEY is not set in environment variables. The API might reject the request.");
    }
    const rawNews = await fetchRawNews();

    if (!rawNews || rawNews.length === 0) {
      console.warn("[NewsService] No news found");
      return [];
    }

    console.log(
      `[NewsService] Processing ${rawNews.length} articles with concurrency limit...`,
    );
    return await processAndTranslateBatch(rawNews);
  } catch (error) {
    console.error("[NewsService] Fatal error in fetchAndProcessNews:", error);
    return []; // Return empty array to prevent 500 in UI
  }
}
