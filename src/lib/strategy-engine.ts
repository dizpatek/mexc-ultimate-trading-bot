import { getStrategiesByUser, createStrategySignal, Strategy } from './db';
import { createStrategy, StrategyParameters } from './strategies';
import { handleBuySignal, handleSellSignal } from './trade';

const DEFAULT_USER_ID = 1; // Assuming single user mode for now or iterate all users in future

export async function runActiveStrategies() {
    console.log('[StrategyEngine] Starting strategy execution cycle...');

    try {
        // 1. Fetch active strategies
        // In a multi-user system, we'd fetch all active strategies across all users.
        // For now, we'll just fetch for the default user.
        const strategies = await getStrategiesByUser(DEFAULT_USER_ID);
        const activeStrategies = strategies.filter(s => s.active);

        if (activeStrategies.length === 0) {
            console.log('[StrategyEngine] No active strategies found.');
            return;
        }

        console.log(`[StrategyEngine] Processing ${activeStrategies.length} active strategies...`);

        // 2. Process each strategy
        for (const strategy of activeStrategies) {
            await processStrategy(strategy);
        }

    } catch (error) {
        console.error('[StrategyEngine] Critical error in execution cycle:', error);
    }
}

async function processStrategy(strategy: Strategy) {
    try {
        const symbol = strategy.symbol;
        console.log(`[StrategyEngine] Analyzing ${strategy.name} (${symbol})...`);

        // Instantiate strategy - cast parameters to StrategyParameters
        const parameters = (strategy.parameters || {}) as StrategyParameters;
        const strategyInstance = createStrategy(strategy.strategy_type, symbol, parameters);
        
        // Analyze market
        const signal = await strategyInstance.analyze();

        if (!signal || !signal.signal) {
            // No signal, do nothing
            return;
        }

        console.log(`[StrategyEngine] 🚨 SIGNAL DETECTED for ${strategy.name}: ${signal.signal}`);

        // Execute Trade
        let executionResult: Record<string, unknown> = { executed: false, reason: 'Simulation mode or error' };
        let executed = false;

        // Determine trade parameters (could be part of strategy config in future)
        // Defaulting to 1% risk for now
        const riskPerTrade = 0.01; 

        try {
            if (signal.signal === 'BUY') {
                const res = await handleBuySignal({
                    pair: symbol,
                    risk: riskPerTrade,
                    balancePercent: 10 // Example: Use 10% of available USDT per trade
                });
                executionResult = res as Record<string, unknown>;
                executed = true;
            } else if (signal.signal === 'SELL') {
                const res = await handleSellSignal({
                    pair: symbol,
                    percent: 100 // Sell 100% of holdings for this pair
                });
                executionResult = res as Record<string, unknown>;
                executed = true;
            }
        } catch (tradeError: unknown) {
            console.error(`[StrategyEngine] Trade execution failed for ${strategy.name}:`, tradeError instanceof Error ? tradeError.message : String(tradeError));
            executionResult = { error: tradeError instanceof Error ? tradeError.message : String(tradeError) };
        }

        // Log Signal & Execution
        await createStrategySignal({
            strategy_id: strategy.id,
            signal_type: signal.signal,
            price: signal.indicators.f4Slope !== undefined ? Number(signal.indicators.f4Slope) : undefined,
            timestamp: Date.now(),
            executed: executed,
            execution_result: executionResult
        });

    } catch (error: unknown) {
        console.error(`[StrategyEngine] Error processing strategy ${strategy.id}:`, error instanceof Error ? error.message : String(error));
    }
}
