import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioSummary, fetchHoldings, fetchRecentTrades } from '../services/api';
import type { PortfolioData, Holding, Trade } from '../services/api';

// Hook to fetch portfolio summary
export const usePortfolioSummary = () => {
    return useQuery<PortfolioData, Error>({
        queryKey: ['portfolioSummary'],
        queryFn: fetchPortfolioSummary,
        refetchInterval: 1000,
        staleTime: 0,
    });
};

// Hook to fetch holdings
export const useHoldings = () => {
    return useQuery<Holding[], Error>({
        queryKey: ['holdings'],
        queryFn: fetchHoldings,
        refetchInterval: 1000,
        staleTime: 0,
    });
};

// Hook to fetch recent trades
export const useRecentTrades = () => {
    return useQuery<Trade[], Error>({
        queryKey: ['recentTrades'],
        queryFn: fetchRecentTrades,
        refetchInterval: 5000, // Trades update less frequently, kept at 5s to save some quota
        staleTime: 0,
    });
};
