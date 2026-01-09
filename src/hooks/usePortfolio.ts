import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioSummary, fetchHoldings, fetchRecentTrades } from '../services/api';
import type { PortfolioData, Holding, Trade } from '../services/api';

// Hook to fetch portfolio summary
export const usePortfolioSummary = () => {
    return useQuery<PortfolioData, Error>({
        queryKey: ['portfolioSummary'],
        queryFn: fetchPortfolioSummary,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Hook to fetch holdings
export const useHoldings = () => {
    return useQuery<Holding[], Error>({
        queryKey: ['holdings'],
        queryFn: fetchHoldings,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Hook to fetch recent trades
export const useRecentTrades = () => {
    return useQuery<Trade[], Error>({
        queryKey: ['recentTrades'],
        queryFn: fetchRecentTrades,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};
