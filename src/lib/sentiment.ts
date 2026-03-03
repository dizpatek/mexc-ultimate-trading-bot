/**
 * News Sentiment Analysis Engine
 * Provides weighted keyword-based sentiment analysis for crypto news.
 */

export interface SentimentResult {
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    asset: string;
    score: number;       // -100 to +100
    confidence: number;  // 0 to 95
}

// Weighted keyword definitions
const BULL_KEYWORDS: [string, number][] = [
    ['SURGE', 30], ['RALLY', 25], ['RECORD', 25], ['ATH', 30], ['ALL-TIME HIGH', 35],
    ['BREAKS', 20], ['BUYS', 20], ['ADOPTION', 15], ['LAUNCH', 15], ['APPROVAL', 25],
    ['GREEN', 10], ['BULLISH', 20], ['PARTNERSHIP', 15], ['INSTITUTIONAL', 20],
    ['YÜKSELİŞ', 25], ['KIRDI', 20], ['REKOR', 25], ['ONAY', 25],
    ['PUMP', 20], ['MOON', 15], ['UPGRADE', 15], ['ACCEPTED', 20],
];

const BEAR_KEYWORDS: [string, number][] = [
    ['CRASH', -35], ['DROP', -20], ['SELL', -15], ['HACK', -35], ['BAN', -30],
    ['REGULATION', -15], ['DELAY', -15], ['REJECT', -25], ['RED', -10],
    ['BEARISH', -20], ['DUMP', -25], ['SCAM', -35], ['LAWSUIT', -20],
    ['DÜŞÜŞ', -25], ['KAYIP', -20], ['ERTELEDİ', -15], ['DÜŞTÜ', -20],
    ['VULNERABILITY', -30], ['EXPLOIT', -35], ['BANKRUPT', -40],
];

// Asset detection patterns
const ASSET_PATTERNS: [string[], string][] = [
    [['BTC', 'BITCOIN'], 'BTC'],
    [['ETH', 'ETHEREUM'], 'ETH'],
    [['SOL', 'SOLANA'], 'SOL'],
    [['XRP', 'RIPPLE'], 'XRP'],
    [['DOGE', 'DOGECOIN'], 'DOGE'],
    [['ADA', 'CARDANO'], 'ADA'],
    [['AVAX', 'AVALANCHE'], 'AVAX'],
];

/**
 * Analyze the sentiment of a news headline.
 */
export function analyzeSentiment(title: string): SentimentResult {
    const t = title.toUpperCase();
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let asset = 'GLOBAL';
    let score = 0;
    let confidence = 40;

    // Asset detection
    for (const [keywords, sym] of ASSET_PATTERNS) {
        if (keywords.some(kw => t.includes(kw))) {
            asset = sym;
            break;
        }
    }

    // Score accumulation
    BULL_KEYWORDS.forEach(([word, weight]) => {
        if (t.includes(word)) { score += weight; confidence += 8; }
    });
    BEAR_KEYWORDS.forEach(([word, weight]) => {
        if (t.includes(word)) { score += weight; confidence += 8; }
    });

    // Critical impact sources
    if (t.includes('FED') || t.includes('SEC') || t.includes('ETF') || t.includes('FOMC')) {
        impact = 'HIGH';
        confidence += 15;
    }

    // Determine sentiment from score
    if (score > 10) sentiment = 'BULLISH';
    else if (score < -10) sentiment = 'BEARISH';

    // Impact from score magnitude
    if (Math.abs(score) > 30) impact = 'HIGH';
    else if (Math.abs(score) > 15) impact = impact === 'HIGH' ? 'HIGH' : 'MEDIUM';

    // Asset-based impact boost
    if (asset === 'BTC' && sentiment !== 'NEUTRAL') impact = 'HIGH';

    // Clamp values
    score = Math.max(-100, Math.min(100, score));
    confidence = Math.min(95, confidence);

    return { sentiment, impact, asset, score, confidence };
}
