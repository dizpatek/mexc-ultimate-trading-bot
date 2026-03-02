
import axios from 'axios';

export interface ScanResult {
    symbol: string;
    ticker: string;
    exchange: string;
    close: number;
    change: number;
    volume: number;
    rsi?: number;
    sma20?: number;
    bbUpper?: number;
    bbLower?: number;
    bbw?: number;
    rating?: number;
}

export class MarketScannerService {
    private static SCANNER_URL = 'https://scanner.tradingview.com/crypto/scan';

    /**
     * Fetch top gainers/losers or specific technical scans
     */
    static async scan(params: {
        exchange?: string;
        market?: 'crypto' | 'america' | 'turkey';
        limit?: number;
        sortField?: string;
        sortOrder?: 'desc' | 'asc';
        timeframe?: '5' | '15' | '60' | '240' | '1D';
    }): Promise<ScanResult[]> {
        const {
            exchange = 'BINANCE',
            market = 'crypto',
            limit = 20,
            sortField = 'change',
            sortOrder = 'desc',
            timeframe = '60'
        } = params;

        // Map resolution to column suffix if needed
        // For 'crypto' market, the base columns usually apply to 1D, 
        // while other resolutions use |suffixes (e.g. change|60)
        const suffix = timeframe === '1D' ? '' : `|${timeframe}`;
        
        const endpoint = `https://scanner.tradingview.com/${market}/scan`;

        const payload = {
            filter: [
                { left: 'exchange', operation: 'equal', right: exchange }
            ],
            options: { lang: 'en' },
            symbols: { query: { types: [] }, tickers: [] },
            columns: [
                'name',
                'description',
                'logoid',
                'update_mode',
                'type',
                'typespecs',
                'exchange',
                `close${suffix}`,
                `change${suffix}`,
                `volume${suffix}`,
                `RSI${suffix}`,
                `SMA20${suffix}`,
                `BB.upper${suffix}`,
                `BB.lower${suffix}`,
                `EMA50${suffix}`
            ],
            sort: { sortBy: `change${suffix}`, sortOrder },
            range: [0, limit],
            markets: [market]
        };

        try {
            const response = await axios.post(endpoint, payload);
            const data = response.data;

            if (!data || !data.data) return [];

            return data.data.map((item: any) => {
                const cols = item.d;
                // Index 0: name, 1: description, 6: exchange, 7: close, 8: change, 9: volume ...
                const close = cols[7];
                const change = cols[8];
                const volume = cols[9];
                const rsi = cols[10];
                const sma20 = cols[11];
                const upper = cols[12];
                const lower = cols[13];
                
                const bbw = upper && lower && close ? (upper - lower) / close : 0;
                
                // Simplified rating logic matching the MCP version (-3 to +3)
                let rating = 0;
                if (upper && lower && close) {
                    const mid = (upper + lower) / 2;
                    if (close > upper) rating = 3;
                    else if (close > mid) rating = 2;
                    else if (close > lower) rating = -2;
                    else rating = -3;
                }

                return {
                    symbol: item.s,
                    ticker: cols[0],
                    exchange: cols[6],
                    close,
                    change,
                    volume,
                    rsi,
                    sma20,
                    bbUpper: upper,
                    bbLower: lower,
                    bbw,
                    rating
                };
            });
        } catch (error) {
            console.error('TradingView Scan Error:', error);
            return [];
        }
    }

    /**
     * Specific scan for Bollinger Band Squeezes
     */
    static async scanSqueeze(exchange = 'BINANCE', limit = 20) {
        return this.scan({
            exchange,
            limit,
            sortField: 'BBW', // We will derive this or use TV's BBW if available
            sortOrder: 'asc'
        });
    }
}
