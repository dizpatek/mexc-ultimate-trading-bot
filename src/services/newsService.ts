import axios from "axios";
import https from "https";
import crypto from "crypto";

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
 * P4.3: RSS Fallback to bypass API limits
 */
async function fetchRssNews(): Promise<CryptoCompareArticle[]> {
  const feeds = [
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cryptoslate.com/feed/",
    "https://news.bitcoin.com/feed/",
    "https://blockworks.co/feed",
  ];
  
  const httpsAgent = getHttpsAgent();
  const allArticles: CryptoCompareArticle[] = [];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  };

  for (const feedUrl of feeds) {
    try {
      const res = await axios.get(feedUrl, { httpsAgent, timeout: 5000, headers });
      const xml = res.data;
      
      // Light-weight regex parser for RSS items (avoids heavy dependencies)
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        
        const extract = (tag: string) => {
          const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(itemContent);
          return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
        };

        const title = extract("title");
        const url = extract("link");
        const body = extract("description").replace(/<[^>]*>?/gm, ''); // Strip HTML
        const pubDateStr = extract("pubDate");
        const pubDate = pubDateStr ? Math.floor(new Date(pubDateStr).getTime() / 1000) : Math.floor(Date.now() / 1000);
        
        if (title && url) {
          allArticles.push({
            id: `rss-${crypto.createHash('md5').update(url).digest('hex').substring(0, 16)}`,
            title,
            body,
            source_info: { name: feedUrl.includes("cointelegraph") ? "CoinTelegraph" : "CoinDesk" },
            published_on: pubDate,
            url,
            imageurl: "", // RSS often doesn't have a simple <img> tag in the root
          });
        }
      }
    } catch (e) {
      console.warn(`[NewsService] Failed to fetch RSS feed: ${feedUrl}`, e);
    }
  }
  
  return allArticles;
}

/**
 * P4.2: SRP - Separate fetching logic
 */
async function fetchRawNews(): Promise<CryptoCompareArticle[]> {
  const httpsAgent = getHttpsAgent();
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY || "";
  const authHeaders = apiKey ? { authorization: `Apikey ${apiKey}` } : {};
  
  let articles: CryptoCompareArticle[] = [];
  
  try {
    const response = await axios.get(
      "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=100",
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

    if (response.data?.Response !== "Error" && response.data && Array.isArray(response.data.Data)) {
       articles = response.data.Data;
    } else {
       console.warn("[NewsService] CryptoCompare API Error or Limit Hit. Falling back to RSS...");
    }
  } catch (err) {
    console.warn("[NewsService] CryptoCompare Fetch error. Falling back to RSS...");
  }

  // If API failed or returned empty, use RSS
  if (articles.length === 0) {
    articles = await fetchRssNews();
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - (24 * 60 * 60); // Exact 24 hours ago

  // Combine, Deduplicate by ID and Sort
  const uniqueArticles = Array.from(new Map(articles.map(a => [a.id, a])).values());

  // Increase display limit to 100 for better overview 
  return uniqueArticles.filter(
    (a: CryptoCompareArticle) => a.published_on > cutoff,
  ).sort((a, b) => b.published_on - a.published_on).slice(0, 100);
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

import { getRecentNews, insertNewsBulk } from "@/lib/db";

export async function fetchAndProcessNews(force = false): Promise<ProcessedNewsItem[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // P4.2: Try DB first to prevent rate limits
    const cachedNews = await getRecentNews(50, 24).catch(() => []);
    
    // Find the newest item in cache
    const newestItem = cachedNews.length > 0 ? cachedNews[0].publishedOn : 0;
    const cacheAgeMinutes = (now - newestItem) / 60;

    // P4.3: If cache is fresh enough and not empty, serve from DB (unless forced)
    if (!force && cachedNews.length >= 20 && cacheAgeMinutes < 15) {
      console.log(`[NewsService] Serving ${cachedNews.length} items from DB cache (Age: ${cacheAgeMinutes.toFixed(1)}m)`);
      return cachedNews;
    }

    console.log("[NewsService] Fetching from API... Key:", process.env.CRYPTOCOMPARE_API_KEY ? "SET" : "MISSING");
    let rawNews: CryptoCompareArticle[] = [];
    try {
      rawNews = await fetchRawNews();
      console.log(`[NewsService] Raw news count from API: ${rawNews.length}`);
    } catch (apiErr) {
      console.error("[NewsService] API Fetch failed, falling back to database:", apiErr);
      return cachedNews; // Return whatever we have in DB
    }

    if (!rawNews || rawNews.length === 0) {
      console.log(`[NewsService] API returned no news. Cache count: ${cachedNews.length}`);
      return cachedNews;
    }

    console.log(`[NewsService] Processing ${rawNews.length} fresh articles...`);
    const processed = await processAndTranslateBatch(rawNews);
    
    // P4.3: Final De-duplicate by ID before returning to UI to fix React "same key" error
    const uniqueProcessed = Array.from(new Map(processed.map(n => [n.id, n])).values());

    // Update DB in background
    insertNewsBulk(uniqueProcessed).catch(err => {
      console.error("[NewsService] DB Update Failed:", err);
    });

    return uniqueProcessed;
  } catch (error) {
    console.error("[NewsService] Fatal error in fetchAndProcessNews:", error);
    return []; // Return empty avoids 500, UI handles empty
  }
}
