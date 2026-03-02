import { checkTrailingStops } from './lib/trailing-stop';
import { monitorSmartTrades } from './lib/smart-trade-monitor';

export async function register() {
    // Only run this on the server runtime (nodejs)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const MONITOR_INTERVAL = 12000; // Match the 12s we set in smart-trade-monitor
        
        console.log('----------------------------------------------------');
        console.log('🚀 MEXC ULTIMATE BOT: STARTING PERSISTENT MONITOR...');
        console.log(`⏱️ Interval: ${MONITOR_INTERVAL}ms`);
        console.log('----------------------------------------------------');

        // Note: setInterval will run as long as the container is alive
        // This replaces the need for Vercel Cron on persistent hosting platforms.
        setInterval(async () => {
            try {
                // Also trigger the trailing stop logic
                await checkTrailingStops();
                // Then the main smart trade monitoring
                await monitorSmartTrades();
            } catch (err) {
                console.error('[Instrumentation] Fatal loop error:', err);
            }
        }, MONITOR_INTERVAL);
    }
}
