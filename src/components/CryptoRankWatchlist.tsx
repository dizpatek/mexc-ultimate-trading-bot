"use client";

import { useState, useEffect, memo } from "react";
import {
  List,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";

interface CryptoData {
  id: string;
  key: string;
  name: string;
  symbol: string;
  prices: {
    USD: {
      price: number;
      priceChange24h: number;
      priceChange24hPercent: number;
      marketCap: number;
      volume24h: number;
    };
  };
  level: number;
}

interface WatchlistProps {
  watchlistId?: string;
}

function CryptoRankWatchlistComponent({
  watchlistId = "4f7effbd40d4",
}: WatchlistProps) {
  const [coins, setCoins] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.cryptorank.io/v0/coins?ids=&limit=50&sort=marketCap&order=desc`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();

      if (data.data) {
        setCoins(data.data.slice(0, 20));
      }
    } catch (err) {
      console.error("[CryptoRankWatchlist] Error:", err);
      setError("Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();

    const interval = setInterval(fetchWatchlist, 60000);
    return () => clearInterval(interval);
  }, [watchlistId]);

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  };

  if (loading && coins.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
          <span className="text-xs text-slate-500 font-medium">
            Yükleniyor...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs text-red-400 font-medium">{error}</span>
          <button
            onClick={fetchWatchlist}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700"
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Market Overview
          </span>
        </div>
        <button
          onClick={fetchWatchlist}
          className="p-1.5 hover:bg-slate-800 rounded transition-colors"
          title="Yenile"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/50">
        <div className="col-span-1">#</div>
        <div className="col-span-4">Coin</div>
        <div className="col-span-3 text-right">Fiyat</div>
        <div className="col-span-4 text-right">24s Değişim</div>
      </div>

      {/* Coin List */}
      <div className="flex-1 overflow-y-auto">
        {coins.map((coin, index) => (
          <div
            key={coin.id}
            className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-800/30"
          >
            <div className="col-span-1 flex items-center">
              <span className="text-xs text-slate-500 font-medium">
                {index + 1}
              </span>
            </div>
            <div className="col-span-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                {coin.symbol?.slice(0, 2)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-200 truncate max-w-[80px]">
                  {coin.name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {coin.symbol}
                </span>
              </div>
            </div>
            <div className="col-span-3 flex items-center justify-end">
              <span className="text-xs font-mono font-medium text-slate-200">
                ${formatPrice(coin.prices?.USD?.price || 0)}
              </span>
            </div>
            <div className="col-span-4 flex items-center justify-end gap-1">
              {coin.prices?.USD?.priceChange24hPercent >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-500" />
              )}
              <span
                className={`text-xs font-mono font-bold ${
                  coin.prices?.USD?.priceChange24hPercent >= 0
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >
                {coin.prices?.USD?.priceChange24hPercent >= 0 ? "+" : ""}
                {(coin.prices?.USD?.priceChange24hPercent || 0).toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/50">
        <a
          href="https://cryptorank.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <span>Powered by CryptoRank</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export const CryptoRankWatchlist = memo(CryptoRankWatchlistComponent);
