import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const TARGET_SYMBOLS = [
    'quil', 'griffain', 'dnx', 'gpu', 'rai', 'vista', 'mkr', 'hnt', 
    'cgpt', 'gmx', 'tao', 'aitech', 'nst', 'ldo', 'render', 'zeph'
];

export async function GET() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                ids: TARGET_SYMBOLS.join(','),
                order: 'market_cap_desc',
                per_page: 250,
                page: 1,
                sparkline: false,
                price_change_percentage: '24h,7d,30d,90d'
            },
            timeout: 15000
        });

        if (!response.data || response.data.length === 0) {
            return NextResponse.json([]);
        }

        const marketData = response.data.map((coin: any) => ({
            symbol: coin.symbol,
            name: coin.name,
            price: coin.current_price || 0,
            change24h: coin.price_change_percentage_24h || 0,
            change7d: coin.price_change_percentage_7d_in_currency || 0,
            change30d: coin.price_change_percentage_30d_in_currency || 0,
            change90d: coin.price_change_percentage_90d_in_currency || 0,
            volume: coin.total_volume || 0,
            rank: coin.market_cap_rank || 0,
            marketCap: coin.market_cap || 0,
            circulatingSupply: coin.circulating_supply || 0,
            totalSupply: coin.total_supply || 0,
            circulatingSupplyPercent: coin.circulating_supply && coin.total_supply 
                ? (coin.circulating_supply / coin.total_supply) * 100 
                : 0
        }));

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
