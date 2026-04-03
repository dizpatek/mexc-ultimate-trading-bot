export interface Trade {
  id?: string | number;
  T: number;
  p: number;
  q: number;
  side: number;
}

export class DataService {
  rawList: Trade[];
  list: Trade[];
  startTime: number;
  endTime: number;
  symbol: string;
  error: string;
  state: number; // -1: initial, 0: loading, 1: error, 2: success
  aggregated: boolean;
  aggregatedList: Trade[] | null;
  normalList: Trade[] | null;
  threshold: number;
  ws: WebSocket | null;
  currentFetchStart: number;
  currentFetchEnd: number;
  isBulkLoading: boolean; // True during initial sequential chunk loading

  constructor() {
    this.rawList = [];
    this.list = [];
    this.startTime = 0;
    this.endTime = 0;
    this.symbol = "";
    this.error = "";
    this.state = -1;

    this.aggregated = false;
    this.aggregatedList = null;
    this.normalList = null;
    this.threshold = 0;
    
    this.ws = null;
    this.currentFetchStart = 0;
    this.currentFetchEnd = 0;
    this.isBulkLoading = false;
  }

  reset() {
    this.rawList = [];
    this.list = [];
    this.startTime = 0;
    this.endTime = 0;
    this.state = -1;
    this.aggregated = false;
    this.aggregatedList = null;
    this.error = "";
    this.isBulkLoading = false;
    this.closeStream();
  }

  closeStream() {
    if (this.ws) {
        this.ws.close();
        this.ws = null;
    }
  }

  toggleAggregation(): void {
    this.aggregated = !this.aggregated;
    if (this.aggregated) {
       this.computeAggregation();
       this.list = this.aggregatedList || this.rawList;
    } else {
       this.list = this.rawList;
    }
  }

  computeAggregation() {
    if (this.rawList.length === 0) return;
    console.log("Aggregating trades...");
    const map = new Map();
    // Agresif birleştirme penceresi (küçük fiyatları birleştirip temiz bir görüntü elde etmek için)
    const timeBucket = 2000; // 50ms yerine 2 saniyelik havuzlar
    
    for (let i = 0; i < this.rawList.length; i++) {
      const trade = this.rawList[i];
      const t = trade.T;
      const p = trade.p;
      
      // Round time and price to create clusters
      const tKey = Math.floor(t / timeBucket) * timeBucket;
      // Fiyat havuzu (daha yuvarlak fiyatlar)
      const pBucket = p > 1000 ? 5 : p > 1 ? 0.05 : p * 0.005; const pKey = Math.round(p / pBucket) * pBucket;
      const key = `${tKey}-${pKey}-${trade.side}`;
      
      if (map.has(key)) {
        const existing = map.get(key);
        existing.q += trade.q;
        existing.vol += p * trade.q;
      } else {
        map.set(key, { ...trade, T: tKey, p: pKey, vol: p * trade.q });
      }
    }

    // Ortalama (t.vol/t.q) almayı kaldırdık; aksi halde pBucket'ın yarattığı kusursuz sıralı fiyat dizilimi bozuluyordu.
    this.aggregatedList = Array.from(map.values());
    
    // Determine threshold for text labels
    const orderSizes = this.aggregatedList.map(t => t.p * t.q).sort((a, b) => b - a);
    if (orderSizes.length > 0) {
      this.threshold = orderSizes[Math.min(orderSizes.length - 1, 13)];
      if (this.threshold > 50000) {
        this.threshold = orderSizes[Math.min(orderSizes.length - 1, 30)];
      }
    } else {
      this.threshold = 0;
    }
    console.log("Aggregation threshold:", this.threshold);
  }

  async loadRange(symbol: string, exchangeStr: string, startTime: number, endTime: number): Promise<void> {
    if (this.state === 0) return; // Prevent overlapping requests
    if (this.isBulkLoading) return; // Prevent lazy-load interruption during bulk sequential fetch
    this.symbol = symbol;
    this.state = 0;
    
    // Bound check to prevent API errors
    const now = Date.now();
    // Use a small buffer to handle slight clock skews
    if (startTime > now + 30000) { 
      console.log("Skipping fetch: start time is too far in the future.");
      this.state = 2; 
      return;
    }
    
    // Cap to now but allow a few seconds buffer
    if (endTime > now + 5000) endTime = now + 5000;
    if (startTime > endTime) startTime = endTime - 1000;
    if (startTime < 0) startTime = 0;

    this.currentFetchStart = startTime;
    this.currentFetchEnd = endTime;
    // If ALL is passed, we fetch from all exchanges simultaneously via our DB route
    const SPOT_EXCHANGES = [
      "BINANCE_SPOT", "BYBIT_SPOT", "OKX_SPOT", "BITGET_SPOT", "MEXC_SPOT",
      "KUCOIN_SPOT", "GATE_SPOT", "HUOBI_SPOT", "HTX_SPOT", "COINBASE_SPOT",
      "KRAKEN_SPOT", "BITSTAMP_SPOT", "PHEMEX_SPOT", "WOO_SPOT", "CRYPTOCOM_SPOT"
    ];
    
    const PERP_EXCHANGES = [
      "BINANCE_PERP", "BYBIT_PERP", "OKX_PERP", "BITGET_PERP", "MEXC_PERP",
      "KUCOIN_PERP", "GATE_PERP", "HUOBI_PERP", "HTX_PERP", "PHEMEX_PERP",
      "BITMEX_PERP", "DERIBIT_PERP", "WOO_PERP"
    ];
    
    let apiExchangeParam = exchangeStr;
    if (exchangeStr === "ALL") {
        apiExchangeParam = [...SPOT_EXCHANGES, ...PERP_EXCHANGES].join(',');
    } else if (exchangeStr === "ALL_SPOT") {
        apiExchangeParam = SPOT_EXCHANGES.join(',');
    } else if (exchangeStr === "ALL_PERP") {
        apiExchangeParam = PERP_EXCHANGES.join(',');
    }

    // --- Pipelined Parallel Fetch (Newest-to-Oldest Processing) ---
    // All chunks fire network requests simultaneously for max speed,
    // but results are processed in newest→oldest order for visual consistency.
    const totalDuration = endTime - startTime;
    const maxChunkDurationMs = 2 * 60 * 1000; // 2 minutes per chunk to stay under API limits
    const numChunks = Math.max(1, Math.ceil(totalDuration / maxChunkDurationMs));
    
    try {
        // Mark as bulk loading if there are multiple chunks
        if (numChunks > 1) this.isBulkLoading = true;
        const chunkDuration = totalDuration / numChunks;

        // Batched Parallel loop: Fetch in concurrent batches (e.g. 4 chunks at a time)
        // This gives parallel network speed without freezing the UI or hitting CCXT rate limits.
        const BATCH_SIZE = 4;
        for (let i = 0; i < numChunks; i += BATCH_SIZE) {
            const batchPromises = [];
            
            // Fire up to BATCH_SIZE requests concurrently
            for (let j = 0; j < BATCH_SIZE && (i + j) < numChunks; j++) {
                const chunkIndex = i + j;
                const chunkEnd = Math.floor(endTime - (chunkIndex * chunkDuration));
                const chunkStart = Math.floor(endTime - ((chunkIndex + 1) * chunkDuration));
                const url = `/api/market/trades?exchange=${apiExchangeParam}&symbol=${symbol}&from=${chunkStart}&to=${chunkEnd}`;
                
                console.log(`[FETCH] Chunk ${chunkIndex + 1}/${numChunks} : ${new Date(chunkStart).toLocaleTimeString()} → ${new Date(chunkEnd).toLocaleTimeString()}`);
                
                batchPromises.push(
                    fetch(url).then(async (response) => {
                        if (!response.ok) throw new Error(`Server Error (${response.status})`);
                        const data = await response.json();
                        if (data.error) throw new Error(data.error);
                        
                        // If response is a map of exchanges, flatten it to a single array of trades
                        let tradesArray: any[] = [];
                        if (Array.isArray(data)) {
                            tradesArray = data;
                        } else if (data.trades && Array.isArray(data.trades)) {
                            tradesArray = data.trades;
                        } else if (typeof data === 'object') {
                            tradesArray = Object.values(data).flat();
                        }
                        
                        const mappedTrades = tradesArray.map((tr: any) => ({
                            id: tr.id || `${tr.t}-${tr.p}-${tr.q}`,
                            T: tr.t || tr.T,
                            p: parseFloat(tr.p),
                            q: parseFloat(tr.q),
                            side: tr.side
                        }));
                        
                        return { trades: mappedTrades, start: chunkStart, end: chunkEnd, index: chunkIndex };
                    }).catch(err => {
                        console.warn(`[FETCH] Chunk ${chunkIndex + 1} failed:`, err);
                        return { trades: [], start: chunkStart, end: chunkEnd, index: chunkIndex };
                    })
                );
            }

            // Wait for the entire batch to download simultaneously
            const batchResults = await Promise.all(batchPromises);

            // Process results sequentially (newest first in this batch) to prepopulate UI safely
            for (const result of batchResults) {
                if (result.trades.length > 0) {
                    this.currentFetchStart = Math.min(this.currentFetchStart, result.start);
                    this.currentFetchEnd = Math.max(this.currentFetchEnd, result.end);
                    
                    const isOlderChunk = result.index > 0;
                    this.processTrades(result.trades, isOlderChunk);
                    
                    if (this.isBulkLoading) this.state = 0;
                }
            }
            
            // Yield to the main thread after processing a batch so the browser can paint the UI
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Bulk loading finished - NOW allow other systems to work
        this.isBulkLoading = false;

        // Ensure final state is set
        this.currentFetchStart = startTime;
        this.currentFetchEnd = endTime;
        if (this.state !== 1) this.state = 2;
        
        // ONLY connect WebSocket AFTER all historical data is loaded
        if (endTime >= Date.now() - 60000 && !this.ws) {
            this.connectLiveStream(symbol, exchangeStr);
        }
        
    } catch (err) {
      if (this.list.length > 0) {
          console.warn("Silent API Error:", err);
          this.state = 2; // Keep existing data
          return;
      }
      console.error("API Error:", err);
      this.error = (err as Error).message || "Failed to fetch data from API.";
      this.state = 1;
    }
  }

  processTrades(newTrades: Array<Omit<Trade, 'p' | 'q'> & { p: string | number; q: string | number }>, isOlderChunk = false): void {
    if (newTrades.length === 0) {
        this.startTime = Math.min(this.startTime || Infinity, this.currentFetchStart);
        this.endTime = Math.max(this.endTime || 0, this.currentFetchEnd);
        this.state = 2;
        return;
    }

    // Keep track of added items for this batch
    const parsedBatch: Trade[] = [];
    const minTimestamp = newTrades.length > 0 ? newTrades[0].T - 1000 : 0;
    
    // Check against right end of rawList (most recent) for duplicates
    // since duplicate trades from fetching chunks will typically overlap at boundaries
    const recentIndex = Math.max(0, this.rawList.length - 20000);
    const existingIds = new Set<string | number>();
    for(let i = recentIndex; i < this.rawList.length; i++) {
        const t = this.rawList[i];
        if (t.T >= minTimestamp) {
            existingIds.add(t.id || `${t.T}-${t.p}-${t.q}`);
        }
    }
    
    // For older chunks, we check the left end (oldest) of rawList instead
    if (isOlderChunk) {
        existingIds.clear();
        const searchSize = Math.min(this.rawList.length, 20000);
        for(let i = 0; i < searchSize; i++) {
            const t = this.rawList[i];
            existingIds.add(t.id || `${t.T}-${t.p}-${t.q}`);
        }
    }
    
    let added = false;
    for (const t of newTrades) {
      const id = t.id || `${t.T}-${t.p}-${t.q}`;
      if (!existingIds.has(id)) {
        parsedBatch.push({
          ...t,
          p: typeof t.p === 'string' ? parseFloat(t.p) : t.p,
          q: typeof t.q === 'string' ? parseFloat(t.q) : t.q
        });
        added = true;
      }
    }

    if (added) {
        // Only inner-sort the batch to ensure it's chronological
        parsedBatch.sort((a, b) => a.T - b.T);
        
        if (isOlderChunk) {
            // Unshift strategy for historic data: simply prepend the oldest batch
            // This is O(N) instead of sorting O((N+M)log(N+M)) 
            this.rawList = [...parsedBatch, ...this.rawList];
        } else {
            // Standard append + full sort for newest data / live poll
            this.rawList.push(...parsedBatch);
            this.rawList.sort((a, b) => a.T - b.T);
        }

        if (this.aggregated) {
           this.computeAggregation();
           this.list = this.aggregatedList || [];
        } else {
           this.list = this.rawList;
        }
    }
    
    this.startTime = Math.min(this.startTime || Infinity, this.currentFetchStart);
    this.endTime = Math.max(this.endTime || 0, this.currentFetchEnd);
    this.state = 2;
  }

  // --- Ultra-Fast WebSocket Implementation ---
  connectLiveStream(symbol: string, exchangeStr: string): void {
      this.closeStream();
      
      if (exchangeStr.startsWith("ALL")) {
          console.log(`WebSocket disabled for GLOBAL ${exchangeStr} view (relying on DB sync).`);
          return;
      }
      
      console.log("Starting ultra-low latency WebSocket stream...");
      
      const [exchange, type] = exchangeStr.split("_");
      
      if (exchange === "BINANCE") {
          // Format BTC-USDT to btcusdt
          const coin = symbol.split('-').join('').toLowerCase();
          const baseUrl = type === "PERP" ? "wss://fstream.binance.com/ws" : "wss://stream.binance.com:9443/ws";
          
          this.ws = new WebSocket(`${baseUrl}/${coin}@trade`);
          
          this.ws.onmessage = (event: MessageEvent) => {
              const data = JSON.parse(event.data);
              
              if (data.e === 'trade' || data.e === 'aggTrade') {
                  const trade = {
                      id: data.t || data.a,        // Trade ID
                      T: data.T,                   // Timestamp
                      p: parseFloat(data.p),        // Price
                      q: parseFloat(data.q),        // Quantity
                      side: data.m ? 0 : 1         // isBuyerMaker (true = sell, false = buy)
                  };
                  this.processTrades([trade]);
                  
                  // Signal that new WebSocket data arrived (helps engine re-render instantly)
                  const globalWindow = window as unknown as Window & { onLiveTradeReceived?: () => void };
                  if (globalWindow.onLiveTradeReceived) globalWindow.onLiveTradeReceived();
              }
          };
          this.ws.onerror = (e: Event) => console.error("WebSocket Error:", e);
      } else if (exchange === "BYBIT") {
          // Format BTC-USDT to BTCUSDT
          const coin = symbol.split('-').join('').toUpperCase();
          const baseUrl = type === "PERP" ? "wss://stream.bybit.com/v5/public/linear" : "wss://stream.bybit.com/v5/public/spot";
          
          this.ws = new WebSocket(baseUrl);
          this.ws.onopen = () => {
              if (this.ws) {
                  this.ws.send(JSON.stringify({
                      "op": "subscribe",
                      "args": [`publicTrade.${coin}`]
                  }));
              }
          };
          
          this.ws.onmessage = (event: MessageEvent) => {
              const msg = JSON.parse(event.data);
              if (msg.topic === `publicTrade.${coin}` && msg.data) {
                  const newTrades = msg.data.map((d: { i: string, T: string, p: string, q: string, S: string }) => ({
                      id: d.i,
                      T: parseInt(d.T),
                      p: parseFloat(d.p),
                      q: parseFloat(d.q),
                      side: d.S === "Buy" ? 1 : 0
                  }));
                  this.processTrades(newTrades);
                  const globalWindow = window as unknown as Window & { onLiveTradeReceived?: () => void };
                  if (globalWindow.onLiveTradeReceived) globalWindow.onLiveTradeReceived();
              }
          }
      }
  }
}

