import { useState, useEffect } from 'react';
import { core } from '../services/ApiCore';
import type { PortfolioData, Holding, Trade } from '../services/api';

/**
 * Hook to consume Portfolio Summary from the Core
 */
export const usePortfolioSummary = () => {
    const [data, setData] = useState<PortfolioData | null>(core.portfolio.getData()?.summary || null);
    const [isLoading, setIsLoading] = useState(!data);

    useEffect(() => {
        // Fail-safe: ensure kernel is running if it stalled
        core.portfolio.start();

        return core.portfolio.subscribe((p) => {
            console.log('[usePortfolioSummary] Received update');
            setData(p.summary);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading, error: null, isError: false, refetch: () => core.portfolio.refresh() };
};

/**
 * Hook to consume Holdings from the Core
 */
export const useHoldings = () => {
    const [data, setData] = useState<Holding[] | null>(core.portfolio.getData()?.holdings || null);
    const [isLoading, setIsLoading] = useState(!data);

    useEffect(() => {
        // Fail-safe: ensure kernel is running if it stalled
        core.portfolio.start();

        return core.portfolio.subscribe((p) => {
            console.log('[useHoldings] Received update:', p.holdings?.length);
            setData(p.holdings);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading, error: null, isError: false, refetch: () => core.portfolio.refresh() };
};

/**
 * Hook to consume Recent Trades from the Core
 */
export const useRecentTrades = () => {
    const [data, setData] = useState<Trade[]>(core.portfolio.getData()?.trades || []);
    const [isLoading, setIsLoading] = useState(data.length === 0);

    useEffect(() => {
        // Fail-safe: ensure kernel is running if it stalled
        core.portfolio.start();

        return core.portfolio.subscribe((p) => {
            console.log('[useRecentTrades] Received update:', p.trades?.length);
            setData(p.trades);
            setIsLoading(false);
        });
    }, []);

    return { data, isLoading, error: null, isError: false, refetch: () => core.portfolio.refresh() };
};
