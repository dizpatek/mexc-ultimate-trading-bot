/**
 * Simple Dictionary-based Sentiment Analyzer
 * Analyzes crypto news headlines to determine market sentiment.
 */

const BULLISH_KEYWORDS = [
    'soar', 'surge', 'jump', 'rally', 'bull', 'bullish', 'high', 'record', 'gain',
    'adoption', 'approve', 'launch', 'partnership', 'growth', 'positive', 'buy',
    'accumulate', 'upgrade', 'success', 'breakout', 'moon', 'profit'
];

const BEARISH_KEYWORDS = [
    'plunge', 'drop', 'crash', 'bear', 'bearish', 'low', 'loss', 'ban', 'hack',
    'stolen', 'fraud', 'regulation', 'lawsuit', 'crackdown', 'negative', 'sell',
    'dump', 'fail', 'bankruptcy', 'panic', 'fear', 'risk', 'crisis'
];

export interface SentimentResult {
    score: number; // -100 to 100
    label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
    bullishCount: number;
    bearishCount: number;
    analyzedCount: number;
}

export function analyzeSentiment(headlines: string[]): SentimentResult {
    let bullishCount = 0;
    let bearishCount = 0;
    let totalScore = 0;

    headlines.forEach(headline => {
        const lower = headline.toLowerCase();

        // Simple word matching
        const bullMatches = BULLISH_KEYWORDS.filter(w => lower.includes(w)).length;
        const bearMatches = BEARISH_KEYWORDS.filter(w => lower.includes(w)).length;

        if (bullMatches > bearMatches) {
            bullishCount++;
            totalScore += 1;
        } else if (bearMatches > bullMatches) {
            bearishCount++;
            totalScore -= 1;
        }
    });

    // Normalize score (-100 to 100)
    // If we have 10 headlines, and all represent extreme views, score could be +/- 10
    // We scale it.
    let normalizedScore = 0;
    if (headlines.length > 0) {
        normalizedScore = (totalScore / headlines.length) * 100;
    }

    // Clamp
    normalizedScore = Math.max(-100, Math.min(100, normalizedScore));

    // Determine Label
    let label: SentimentResult['label'] = 'Neutral';
    if (normalizedScore <= -60) label = 'Extreme Fear';
    else if (normalizedScore <= -20) label = 'Fear';
    else if (normalizedScore >= 60) label = 'Extreme Greed';
    else if (normalizedScore >= 20) label = 'Greed';

    return {
        score: Math.round(normalizedScore),
        label,
        bullishCount,
        bearishCount,
        analyzedCount: headlines.length
    };
}
