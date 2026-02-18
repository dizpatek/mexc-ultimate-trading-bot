/**
 * Trading Simulator - Test Mode Trading Engine
 * Provides simulated trading functionality for testing without risking real assets
 */

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
    price?: number;
    status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED';
    executedQty: number;
    executedQuote: number;
    timestamp: number;
}

class TradingSimulator {
    private balances: Map<string, SimulatedBalance> = new Map();
    private orders: Map<string, SimulatedOrder> = new Map();
    private orderIdCounter: number = 1000;

    constructor() {
        // Initialize with default test balance
        this.initializeTestBalance();
    }

    private initializeTestBalance() {
        // Start with $100,000 USDT and some test crypto
        this.balances.set('USDT', { asset: 'USDT', free: 100000, locked: 0 });
        this.balances.set('BTC', { asset: 'BTC', free: 0.5, locked: 0 });
        this.balances.set('ETH', { asset: 'ETH', free: 5, locked: 0 });
        this.balances.set('SOL', { asset: 'SOL', free: 50, locked: 0 });
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
        let balance = this.balances.get(asset);
        if (!balance) {
            // Seed a small amount for any requested asset to allow testing
            balance = { asset, free: 100, locked: 0 };
            this.balances.set(asset, balance);
        }
        return balance;
    }

    async executeMarketBuy(symbol: string, quoteOrderQty: number, currentPrice: number): Promise<SimulatedOrder> {
        // Extract base and quote assets (e.g., BTCUSDT -> BTC, USDT)
        const cleanSymbol = symbol.replace('/', '').toUpperCase();
        const quoteAsset = cleanSymbol.endsWith('USDT') ? 'USDT' : cleanSymbol.slice(-4);
        const baseAsset = cleanSymbol.replace(quoteAsset, '');

        const quoteBalance = this.getBalance(quoteAsset);
        if (quoteBalance.free < quoteOrderQty) {
            console.warn(`[Simulator] Auto-healing ${quoteAsset} balance for ${cleanSymbol}. Needed ${quoteOrderQty}, had ${quoteBalance.free}.`);
            quoteBalance.free = quoteOrderQty * 2;
        }

        // Calculate quantity with 0.1% taker fee
        const fee = quoteOrderQty * 0.001;
        const netAmount = quoteOrderQty - fee;
        const quantity = netAmount / currentPrice;

        // Update balances
        quoteBalance.free -= quoteOrderQty;

        const baseBalance = this.getBalance(baseAsset);
        baseBalance.free += quantity;

        // Create order record
        const orderId = `SIM${this.orderIdCounter++}`;
        const order: SimulatedOrder = {
            orderId,
            symbol: cleanSymbol,
            side: 'BUY',
            type: 'MARKET',
            quoteOrderQty,
            price: currentPrice,
            status: 'FILLED',
            executedQty: quantity,
            executedQuote: quoteOrderQty,
            timestamp: Date.now(),
        };

        this.orders.set(orderId, order);
        return order;
    }

    async executeMarketSell(symbol: string, quantity: number, currentPrice: number): Promise<SimulatedOrder> {
        const cleanSymbol = symbol.replace('/', '').toUpperCase();
        const quoteAsset = cleanSymbol.endsWith('USDT') ? 'USDT' : cleanSymbol.slice(-4);
        const baseAsset = cleanSymbol.replace(quoteAsset, '');

        const baseBalance = this.getBalance(baseAsset);
        if (baseBalance.free < quantity) {
            console.warn(`[Simulator] Auto-healing ${baseAsset} balance for ${cleanSymbol}. Needed ${quantity}, had ${baseBalance.free}.`);
            baseBalance.free = quantity;
        }

        // Calculate quote amount with 0.1% taker fee
        const quoteAmount = quantity * currentPrice;
        const fee = quoteAmount * 0.001;
        const netAmount = quoteAmount - fee;

        // Update balances
        baseBalance.free -= quantity;

        const quoteBalance = this.getBalance(quoteAsset);
        quoteBalance.free += netAmount;

        // Create order record
        const orderId = `SIM${this.orderIdCounter++}`;
        const order: SimulatedOrder = {
            orderId,
            symbol: cleanSymbol,
            side: 'SELL',
            type: 'MARKET',
            quantity,
            price: currentPrice,
            status: 'FILLED',
            executedQty: quantity,
            executedQuote: quoteAmount,
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
    var simulatorInstance: TradingSimulator | undefined;
}

// Singleton instance retrieval
export function getSimulator(): TradingSimulator {
    if (!globalThis.simulatorInstance) {
        globalThis.simulatorInstance = new TradingSimulator();
    }
    return globalThis.simulatorInstance;
}

export function resetSimulator() {
    if (simulatorInstance) {
        simulatorInstance.reset();
    }
}

export type { SimulatedBalance, SimulatedOrder };
