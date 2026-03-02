
import { handleSmartTrade } from './src/lib/smart-trade';

async function test() {
    try {
        console.log('Testing handleSmartTrade (COVER)...');
        const result = await handleSmartTrade({
            mode: 'COVER',
            symbol: 'SOL/USDT',
            amount: '1',
            buyPrice: '150',
            buyType: 'MARKET',
            useExisting: true,
            user_id: 1,
            takeProfit: null,
            stopLoss: null
        }, 'test');
        console.log('Result:', result);
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

test();
