import {
    marketBuyByQuote,
    marketSellByQty,
    placeStopMarket,
    getBalance,
    getPrice
} from './mexc-wrapper';
import {
    insertOrder,
    insertTradeHistory,
    getTradeHistoryBySymbol,
    calculateDailyPerformance
} from './db';
import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM = TELEGRAM_TOKEN ? new TelegramBot(TELEGRAM_TOKEN) : null;

function notify(text: string) {
    console.log(`[TRADE] ${text}`);
    if (TELEGRAM && CHAT_ID) {
        TELEGRAM.sendMessage(CHAT_ID, text).catch(e => console.warn('Telegram error', e.message));
    }
}

export interface BuySignalOptions {
    pair: string;
    risk?: number;
    tp?: number | null;
    sl?: number | null;
    usdt?: number | null;
    balancePercent?: number | null;
}

export async function handleBuySignal({
    pair,
    risk = 0.01,
    tp = null,
    sl = null,
    usdt = null,
    balancePercent = null
}: BuySignalOptions) {
    try {
        console.log('Buy signal received', { pair, risk, tp, sl, usdt, balancePercent });

        if (risk <= 0 || risk > 0.2) risk = Math.min(Math.max(risk, 0.001), 0.05);

        const usdtBalance = await getBalance('USDT');
        const availableUsdt = usdtBalance.free;
        const minBalance = Number(process.env.MIN_USDT_BALANCE) || 10;

        if (availableUsdt < minBalance) {
            const error = `Yetersiz USDT bakiyesi: ${availableUsdt} < ${minBalance}`;
            console.error(error);
            throw new Error(error);
        }

        const defaultTrade = Number(process.env.DEFAULT_TRADE_USDT) || 10;
        let quoteToSpend: number;

        if (usdt) {
            quoteToSpend = usdt;
        } else if (balancePercent) {
            quoteToSpend = availableUsdt * (balancePercent / 100);
        } else {
            const riskAmount = availableUsdt * risk;
            quoteToSpend = Math.max(riskAmount, defaultTrade);
        }

        quoteToSpend = Math.min(quoteToSpend, availableUsdt - minBalance);

        if (quoteToSpend < 5) { // MEXC min order is often 5 USDT
            throw new Error(`İşlem miktarı çok düşük: ${quoteToSpend} USDT`);
        }

        const currentPrice = await getPrice(pair);
        notify(`${pair} mevcut fiyat: ${currentPrice} USDT, bakiye: ${availableUsdt} USDT, işlem miktarı: ${quoteToSpend} USDT`);

        // Place market buy using quoteOrderQty
        const res = await marketBuyByQuote(pair, String(quoteToSpend));
        notify(`BUY executed ${pair} => ${JSON.stringify(res)}`);

        // Calculate average price from fills
        let avgPrice = currentPrice;
        if (res.fills && res.fills.length > 0) {
            const totalQty = res.fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.qty), 0);
            const totalQuote = res.fills.reduce((sum: number, fill: any) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0);
            avgPrice = totalQuote / totalQty;
        }

        // Record primary order in DB
        const dbId = await insertOrder({
            mexc_order_id: res.orderId || null,
            symbol: pair,
            side: 'BUY',
            type: 'MARKET',
            qty: res.executedQty || null,
            quote: res.cummulativeQuoteQty || null,
            price: avgPrice,
            status: 'FILLED',
            meta: res
        });

        // Record in trade history
        await insertTradeHistory({
            order_id: dbId,
            symbol: pair,
            side: 'BUY',
            type: 'MARKET',
            qty: parseFloat(res.executedQty) || 0,
            price: avgPrice,
            quote_qty: parseFloat(res.cummulativeQuoteQty) || quoteToSpend,
            commission: res.fills ? res.fills.reduce((sum: number, f: any) => sum + parseFloat(f.commission || 0), 0) : 0,
            commission_asset: res.fills && res.fills[0] ? res.fills[0].commissionAsset : null
        });

        const executedQty = parseFloat(res.executedQty) || (res.fills && res.fills.reduce((s: number, f: any) => s + Number(f.qty), 0));

        // Place TP/SL if provided
        if (executedQty > 0) {
            try {
                if (sl) {
                    await placeStopMarket(pair, 'SELL', String(sl), String(executedQty));
                    notify(`Placed stop market SELL @ trigger ${sl}`);
                }
                if (tp) {
                    await placeStopMarket(pair, 'SELL', String(tp), String(executedQty));
                    notify(`Placed take-profit SELL @ trigger ${tp}`);
                }
            } catch (e: any) {
                notify(`Could not place TP/SL: ${e.message}`);
            }
        }

        return { ok: true, dbId, raw: res };
    } catch (error: any) {
        console.error('Buy signal failed', error.message, pair);
        throw error;
    }
}

export interface SellSignalOptions {
    pair: string;
    amount?: number | null;
    percent?: number | null;
}

export async function handleSellSignal({ pair, amount = null, percent = null }: SellSignalOptions) {
    try {
        console.log('Sell signal received', { pair, amount, percent });

        let sellAmount = amount;
        const baseAsset = pair.replace(/USDT|USDC|BTC$/, '');

        if (!sellAmount) {
            const balance = await getBalance(baseAsset);

            if (balance.free <= 0) {
                throw new Error(`${baseAsset} bakiyesi yok`);
            }

            if (percent) {
                sellAmount = balance.free * (percent / 100);
            } else {
                sellAmount = balance.free;
            }
        }

        if (!sellAmount || sellAmount <= 0) {
            throw new Error(`Satılacak miktar geçersiz: ${sellAmount}`);
        }

        const currentPrice = await getPrice(pair);
        notify(`${pair} satış: ${sellAmount} adet @ ${currentPrice} USDT`);

        const res = await marketSellByQty(pair, String(sellAmount));
        notify(`SELL executed ${pair} => ${JSON.stringify(res)}`);

        let avgPrice = currentPrice;
        if (res.fills && res.fills.length > 0) {
            const totalQty = res.fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.qty), 0);
            const totalQuote = res.fills.reduce((sum: number, fill: any) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0);
            avgPrice = totalQuote / totalQty;
        }

        const dbId = await insertOrder({
            mexc_order_id: res.orderId || null,
            symbol: pair,
            side: 'SELL',
            type: 'MARKET',
            qty: sellAmount,
            quote: res.cummulativeQuoteQty || null,
            price: avgPrice,
            status: 'FILLED',
            meta: res
        });

        const previousBuys = await getTradeHistoryBySymbol(pair, 10);
        const lastBuy = previousBuys.find(t => t.side === 'BUY');

        let profitLoss = 0;
        let profitLossPercentage = 0;

        if (lastBuy) {
            const buyValue = lastBuy.price * sellAmount;
            const sellValue = avgPrice * sellAmount;
            profitLoss = sellValue - buyValue;
            profitLossPercentage = ((sellValue - buyValue) / buyValue) * 100;
        }

        await insertTradeHistory({
            order_id: dbId,
            symbol: pair,
            side: 'SELL',
            type: 'MARKET',
            qty: parseFloat(res.executedQty) || sellAmount,
            price: avgPrice,
            quote_qty: parseFloat(res.cummulativeQuoteQty) || (sellAmount * avgPrice),
            commission: res.fills ? res.fills.reduce((sum: number, f: any) => sum + parseFloat(f.commission || 0), 0) : 0,
            commission_asset: res.fills && res.fills[0] ? res.fills[0].commissionAsset : null,
            profit_loss: profitLoss,
            profit_loss_percentage: profitLossPercentage
        });

        await calculateDailyPerformance();

        return { ok: true, dbId, raw: res, profitLoss, profitLossPercentage };
    } catch (error: any) {
        console.error('Sell signal failed', error.message, pair);
        throw error;
    }
}
