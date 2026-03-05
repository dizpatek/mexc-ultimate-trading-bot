/**
 * Trading Simulator - Test Mode Trading Engine
 * Provides simulated trading functionality for testing without risking real assets
 */
import { normalizeSymbol, extractBaseAsset } from '@/lib/symbol-utils';

interface SimulatedBalance {
    asset: string;
    free: number;
    locked: number;
}

interface SimulatedOrder {
    orderId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT';
    quantity?: number;
    quoteOrderQty?: number;
    price?: string;
    status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED';
    executedQty: string;
    cummulativeQuoteQty: string;
    timestamp: number;
}

export class TradingSimulator {
    private balances: Map<string, SimulatedBalance> = new Map();
    private orders: Map<string, SimulatedOrder> = new Map();
    private orderIdCounter: number = 1000;
    private userId: number;

    constructor(userId: number = 1) {
        this.userId = userId;
        this.initializeTestBalance();
    }

    public initializeTestBalance() {
        // Start with ~$70,000 total portfolio (proportionally scaled)
        this.balances.set('USDT', { asset: 'USDT', free: 5000, locked: 0 });
        this.balances.set('BTC', { asset: 'BTC', free: 0.5, locked: 0 });
        this.balances.set('ETH', { asset: 'ETH', free: 5, locked: 0 });
        this.balances.set('SOL', { asset: 'SOL', free: 50, locked: 0 });
    }

    public loadBalances(balances: SimulatedBalance[]) {
        this.balances.clear();
        balances.forEach(b => {
            this.balances.set(b.asset, b);
        });
    }

    public setBalance(asset: string, free: number, locked: number = 0) {
        this.balances.set(asset, { asset, free, locked });
    }

    public getAllBalances(): SimulatedBalance[] {
        return Array.from(this.balances.values());
    }

    getAccountInfo() {
        const balances = Array.from(this.balances.values()).map(b => ({
            asset: b.asset,
            free: b.free.toString(),
            locked: b.locked.toString(),
        }));

        return {
            makerCommission: 10,
            takerCommission: 10,
            buyerCommission: 0,
            sellerCommission: 0,
            canTrade: true,
            canWithdraw: true,
            canDeposit: true,
            balances,
        };
    }

    getBalance(asset: string) {
        const balance = this.balances.get(asset);
        if (!balance) {
            // DO NOT auto-seed. If it doesn't exist, it's 0.
            return { asset, free: 0, locked: 0 };
        }
        return balance;
    }

    async executeMarketBuy(symbol: string, quoteOrderQty: number, currentPrice: number): Promise<SimulatedOrder> {
        // Extract base and quote assets robustly
        const cleanSymbol = normalizeSymbol(symbol);
        const quoteAsset = cleanSymbol.endsWith('USDT') ? 'USDT' : 'USDC';
        const baseAsset = extractBaseAsset(cleanSymbol);

        const quoteBalance = this.getBalance(quoteAsset);
        const isInsufficient = (quoteBalance.free + 0.01) < quoteOrderQty;
        
        if (isInsufficient) {
            const diff = quoteOrderQty - quoteBalance.free;
            console.warn(`[Simulator/FORCE_BUY] ${symbol}: Insufficient ${quoteAsset}. Missing ${diff.toFixed(2)}. Procedding anyway.`);
        }

        // Calculate quantity with 0.1% taker fee
        const fee = quoteOrderQty * 0.001;
        const netAmount = quoteOrderQty - fee;
        const quantity = netAmount / currentPrice;

        // Update balances - allow negative in TEST mode (P1.1 Force Close logic)
        quoteBalance.free -= quoteOrderQty;

        const baseBalance = this.getBalance(baseAsset);
        baseBalance.free += quantity;
        this.balances.set(baseAsset, baseBalance);

        // Create order record
        const orderId = `SIM${this.orderIdCounter++}`;
        const order: SimulatedOrder = {
            orderId,
            symbol: cleanSymbol,
            side: 'BUY',
            type: 'MARKET',
            quoteOrderQty,
            price: currentPrice.toString(),
            status: 'FILLED',
            executedQty: quantity.toString(),
            cummulativeQuoteQty: quoteOrderQty.toString(),
            timestamp: Date.now(),
        };

        this.orders.set(orderId, order);
        return order;
    }

    async executeMarketSell(symbol: string, quantity: number, currentPrice: number): Promise<SimulatedOrder> {
        const cleanSymbol = normalizeSymbol(symbol);
        console.log(`[Simulator] Executing Market Sell: ${quantity} ${cleanSymbol} @ ${currentPrice}`);
        
        const quoteAsset = cleanSymbol.endsWith('USDT') ? 'USDT' : 'USDC';
        const baseAsset = extractBaseAsset(cleanSymbol);

        const baseBalance = this.getBalance(baseAsset);
        console.log(`[Simulator] Selling ${baseAsset}. Current balance: ${baseBalance.free}, Requested: ${quantity}`);

        if (baseBalance.free < quantity) {
            const diff = quantity - baseBalance.free;
            const diffPercent = diff / quantity;
            
            // In TEST mode, if requested quantity is higher than balance, 
            // we ALWAYS sell what we have instead of rejecting (P1.1 - Force Close).
            // This prevents trades from getting stuck in open state due to minor balance discrepancies.
            console.log(`[Simulator] Sell Requested: ${quantity}, Available: ${baseBalance.free}. Difference: ${diffPercent.toFixed(4)}%`);
            console.log(`[Simulator] P1.1 Force: Selling all available ${baseAsset} balance (${baseBalance.free}) to close trade in TEST mode.`);
            quantity = baseBalance.free;
        }


        // Calculate quote amount with 0.1% taker fee
        const quoteAmount = quantity * currentPrice;
        const fee = quoteAmount * 0.001;
        const netAmount = quoteAmount - fee;

        // Update balances
        baseBalance.free -= quantity;

        const quoteBalance = this.getBalance(quoteAsset);
        quoteBalance.free += netAmount;
        
        console.log(`[Simulator] After Sell - ${baseAsset}: ${baseBalance.free}, ${quoteAsset}: ${quoteBalance.free}`);

        // Create order record
        const orderId = `SIM${this.orderIdCounter++}`;
        const order: SimulatedOrder = {
            orderId,
            symbol: cleanSymbol,
            side: 'SELL',
            type: 'MARKET',
            quantity,
            price: currentPrice.toString(),
            status: 'FILLED',
            executedQty: quantity.toString(),
            cummulativeQuoteQty: quoteAmount.toString(),
            timestamp: Date.now(),
        };

        this.orders.set(orderId, order);
        return order;
    }

    getOpenOrders(symbol?: string) {
        const openOrders = Array.from(this.orders.values()).filter(
            order => order.status === 'NEW' || order.status === 'PARTIALLY_FILLED'
        );

        if (symbol) {
            return openOrders.filter(order => order.symbol === symbol);
        }

        return openOrders;
    }

    cancelOrder(orderId: string) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        if (order.status === 'FILLED') {
            throw new Error('Cannot cancel filled order');
        }

        order.status = 'CANCELED';
        return order;
    }

    reset() {
        this.balances.clear();
        this.orders.clear();
        this.orderIdCounter = 1000;
        this.initializeTestBalance();
    }

    // Get portfolio value in USDT
    async getPortfolioValue(priceGetter: (symbol: string) => Promise<number>): Promise<number> {
        let totalValue = 0;

        for (const [asset, balance] of this.balances.entries()) {
            const total = balance.free + balance.locked;
            if (total === 0) continue;

            if (asset === 'USDT' || asset === 'USDC') {
                totalValue += total;
            } else {
                try {
                    const price = await priceGetter(`${asset}USDT`);
                    totalValue += total * price;
                } catch {
                    // Skip if price not available
                }
            }
        }

        return totalValue;
    }
}

declare global {
    var simulatorInstances: Map<number, TradingSimulator> | undefined;
}

// Singleton instances retrieval per user
export function getSimulator(userId: number = 1): TradingSimulator {
    if (!globalThis.simulatorInstances) {
        globalThis.simulatorInstances = new Map();
    }
    
    let instance = globalThis.simulatorInstances.get(userId);
    if (!instance) {
        instance = new TradingSimulator(userId);
        globalThis.simulatorInstances.set(userId, instance);
    }
    return instance;
}

export function resetSimulator(userId: number = 1) {
    if (!globalThis.simulatorInstances) {
        globalThis.simulatorInstances = new Map();
    }
    
    let instance = globalThis.simulatorInstances.get(userId);
    if (!instance) {
        instance = new TradingSimulator(userId);
        globalThis.simulatorInstances.set(userId, instance);
    }
    instance.reset();
}

export type { SimulatedBalance, SimulatedOrder };
