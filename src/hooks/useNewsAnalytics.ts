import { useRef, useMemo, useEffect } from "react";
import { NewsItem } from "./useNewsData";

export function useNewsAnalytics(rawNews: NewsItem[]) {
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Enrich news with local UI state (isNew flag)
  const intel = useMemo(() => {
    const processed = rawNews.map((item) => ({
      ...item,
      isNew: seenIdsRef.current.size > 0 && !seenIdsRef.current.has(item.id),
    }));

    return processed;
  }, [rawNews]);

  useEffect(() => {
    if (rawNews.length > 0) {
      const newSet = new Set([
        ...Array.from(seenIdsRef.current),
        ...rawNews.map((i) => i.id),
      ]);
      if (newSet.size > 1000) {
        const arr = Array.from(newSet);
        seenIdsRef.current = new Set(arr.slice(arr.length - 1000));
      } else {
        seenIdsRef.current = newSet;
      }
    }
  }, [rawNews]);

  const aggregateSentiment = useMemo(() => {
    if (intel.length === 0) return 0;
    return Math.round(
      intel.reduce((sum, i) => sum + i.sentimentScore, 0) / intel.length,
    );
  }, [intel]);

  const stats = useMemo(
    () => ({
      bullCount: intel.filter((i) => i.sentiment === "BULLISH").length,
      bearCount: intel.filter((i) => i.sentiment === "BEARISH").length,
    }),
    [intel],
  );

  return { intel, aggregateSentiment, stats };
}
