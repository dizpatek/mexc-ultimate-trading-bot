export class MarketScannerService {
    constructor() {}

    static async scan(config: {
        exchange: string;
        timeframe: string;
        sortOrder: string;
        market: string;
        limit: number;
    }) {
        console.log('[market-scanner-service] scan called - not implemented', config);
        return [];
    }

    static async getMarketOverview() {
        console.log('[market-scanner-service] getMarketOverview called - not implemented');
        return { success: true, overview: null };
    }
}
