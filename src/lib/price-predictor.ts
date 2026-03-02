export async function predictPrice(symbol: string, prices: number[]) {
    console.log('[price-predictor] predictPrice called - not implemented', { symbol, pricesLength: prices?.length });
    return {
        success: true,
        prediction: {
            direction: 'FLAT',
            confidence: 0,
            target: null
        }
    };
}

export async function getPredictionHistory(symbol: string) {
    console.log('[price-predictor] getPredictionHistory called - not implemented', { symbol });
    return { success: true, history: [] };
}
