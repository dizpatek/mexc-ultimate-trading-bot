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
import { getExchangeInfo } from './mexc';
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

export async function getSymbolPrecision(symbol: string) {
    try {
        const info = await getExchangeInfo(symbol) as { symbols: { symbol: string; baseAssetPrecision: number; quoteAssetPrecision: number }[] };
        const s = info?.symbols?.find((item) => item.symbol === symbol);
        if (s) {
            return {
                base: s.baseAssetPrecision || 4,
                quote: s.quoteAssetPrecision || 2
            };
        }
    } catch {
        console.warn(`Could not fetch precision for ${symbol}, using defaults`);
    }
    return { base: 4, quote: 2 };
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

        // Check global bot config
        const { getBotConfig } = await import('./db');
        const botConfig = await getBotConfig();
        
        // Only enforce auto_trade if it's not a manual trade (usdt or balancePercent provided)
        if (!usdt && !balancePercent) {
            if (!botConfig.auto_trade) {
                console.log('System: Auto-Pilot is OFF. Ignoring automated signal.');
                return { ok: false, message: 'Bot pasif (Otomatik Pilot Kapalı)' };
            }
            if (botConfig.defense_mode) {
                console.log('System: Defense Mode is ON. Blocking new buy signal.');
                return { ok: false, message: 'Savunma Modu Aktif (Yeni Alım Engellendi)' };
            }
        }

        if (risk <= 0 || risk > 0.2) risk = Math.min(Math.max(risk, 0.001), 0.05);

        const usdtBalance = await getBalance('USDT');
        const availableUsdt = usdtBalance.free;
        const minBalance = Number(process.env.MIN_USDT_BALANCE) || 10;

        let quoteToSpend: number;

        if (usdt) {
            quoteToSpend = usdt;
            if (availableUsdt < usdt) {
                return { ok: false, message: `Yetersiz USDT bakiyesi: ${availableUsdt.toFixed(4)} < ${usdt}` };
            }
        } else {
            if (availableUsdt < minBalance) {
                return { ok: false, message: `Yetersiz bakiye (Rezerv: ${minBalance} USDT): ${availableUsdt.toFixed(2)}` };
            }

            const defaultTrade = Number(process.env.DEFAULT_TRADE_USDT) || 10;
            if (balancePercent) {
                quoteToSpend = availableUsdt * (balancePercent / 100);
            } else {
                const riskAmount = availableUsdt * risk;
                quoteToSpend = Math.max(riskAmount, defaultTrade);
            }

            // Apply reserve for automatic/percentage trades
            quoteToSpend = Math.min(quoteToSpend, availableUsdt - minBalance);
        }

        if (quoteToSpend < 5) { // MEXC min order is often 5 USDT
            return { ok: false, message: `İşlem miktarı çok düşük: ${quoteToSpend.toFixed(4)} USDT (Min: 5 USDT)` };
        }

        const currentPrice = await getPrice(pair);
        notify(`${pair} mevcut fiyat: ${currentPrice} USDT, bakiye: ${availableUsdt} USDT, işlem miktarı: ${quoteToSpend} USDT`);

        const precision = await getSymbolPrecision(pair);
        const finalQuote = parseFloat(quoteToSpend.toFixed(precision.quote));

        // Place market buy using quoteOrderQty
        const res = await marketBuyByQuote(pair, String(finalQuote)) as { orderId: string; executedQty: string; cummulativeQuoteQty: string; fills?: { price: string; qty: string; commission?: string; commissionAsset?: string }[] };
        notify(`BUY executed ${pair} => ${JSON.stringify(res)}`);

        // Calculate average price from fills or cumulative fields
        let avgPrice = currentPrice;
        if (res.fills && res.fills.length > 0) {
            const totalQty = res.fills.reduce((sum: number, fill) => sum + parseFloat(fill.qty), 0);
            const totalQuote = res.fills.reduce((sum: number, fill) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0);
            avgPrice = totalQuote / totalQty;
        } else if (res.cummulativeQuoteQty && res.executedQty && parseFloat(res.executedQty) > 0) {
            // Fallback: MEXC often doesn't return fills for market orders
            avgPrice = parseFloat(res.cummulativeQuoteQty) / parseFloat(res.executedQty);
        }

        // Record primary order in DB
        const dbId = await insertOrder({
            mexc_order_id: res.orderId || undefined,
            symbol: pair,
            side: 'BUY',
            type: 'MARKET',
            qty: res.executedQty ? parseFloat(res.executedQty) : undefined,
            quote: res.cummulativeQuoteQty ? parseFloat(res.cummulativeQuoteQty) : undefined,
            price: avgPrice,
            status: 'FILLED',
            meta: res as unknown as Record<string, unknown>
        });

        // Record in trade history
        await insertTradeHistory({
            order_id: dbId,
            symbol: pair,
            side: 'BUY',
            type: 'MARKET',
            qty: parseFloat(res.executedQty || '0'),
            price: avgPrice,
            quote_qty: parseFloat(res.cummulativeQuoteQty || '0') || quoteToSpend,
            commission: res.fills ? res.fills.reduce((sum: number, f: { commission?: string }) => sum + parseFloat(f.commission || '0'), 0) : 0,
            commission_asset: (res.fills && res.fills[0]) ? res.fills[0].commissionAsset : undefined
        });

        const executedQty = parseFloat(res.executedQty || '0') || (res.fills && res.fills.reduce((s: number, f: { qty: string }) => s + Number(f.qty), 0)) || 0;

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
            } catch (e: unknown) {
                notify(`Could not place TP/SL: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        return { ok: true, dbId, raw: res };
    } catch (error: unknown) {
        console.error('Buy signal failed', error instanceof Error ? error.message : String(error), pair);
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

        // Check global bot config
        const { getBotConfig } = await import('./db');
        const botConfig = await getBotConfig();
        
        // Only enforce auto_trade if it's not a manual trade (amount provided) or panic sell (percent: 100 with purpose)
        if (!amount && !percent && !botConfig.auto_trade) {
            console.log('System: Auto-Pilot is OFF. Ignoring automated sell signal.');
            return { ok: false, message: 'Bot pasif (Otomatik Pilot Kapalı)' };
        }

        let sellAmount = amount;
        const baseAsset = pair.replace(/USDT|USDC|BTC$/, '');
        const balance = await getBalance(baseAsset);

        if (!sellAmount) {
            if (balance.free <= 0) {
                return { ok: false, message: `${baseAsset} bakiyesi yok` };
            }

            if (percent) {
                sellAmount = balance.free * (percent / 100);
            } else {
                sellAmount = balance.free;
            }
        } else {
            // Proactive balance check even if amount is provided
            if (balance.free < sellAmount) {
                return { ok: false, message: `Yetersiz ${baseAsset} bakiyesi. Mevcut: ${balance.free.toFixed(4)}` };
            }
        }

        if (!sellAmount || sellAmount <= 0) {
            return { ok: false, message: `Satılacak miktar geçersiz` };
        }

        const precision = await getSymbolPrecision(pair);
        const finalQty = parseFloat(sellAmount.toFixed(precision.base));
        
        const currentPrice = await getPrice(pair);
        notify(`${pair} satış: ${finalQty} adet @ ${currentPrice} USDT`);

        const res = await marketSellByQty(pair, String(finalQty)) as { orderId: string; executedQty: string; cummulativeQuoteQty: string; fills?: { price: string; qty: string; commission?: string; commissionAsset?: string }[] };
        notify(`SELL executed ${pair} => ${JSON.stringify(res)}`);

        let avgPrice = currentPrice;
        if (res.fills && res.fills.length > 0) {
            const totalQty = res.fills.reduce((sum: number, fill) => sum + parseFloat(fill.qty), 0);
            const totalQuote = res.fills.reduce((sum: number, fill) => sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0);
            avgPrice = totalQuote / totalQty;
        } else if (res.cummulativeQuoteQty && res.executedQty && parseFloat(res.executedQty) > 0) {
            // Fallback: MEXC often doesn't return fills for market orders
            avgPrice = parseFloat(res.cummulativeQuoteQty) / parseFloat(res.executedQty);
        }

        const dbId = await insertOrder({
            mexc_order_id: res.orderId || undefined,
            symbol: pair,
            side: 'SELL',
            type: 'MARKET',
            qty: sellAmount,
            quote: res.cummulativeQuoteQty ? parseFloat(res.cummulativeQuoteQty) : undefined,
            price: avgPrice,
            status: 'FILLED',
            meta: res as unknown as Record<string, unknown>
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
            qty: parseFloat(res.executedQty || '0') || sellAmount,
            price: avgPrice,
            quote_qty: parseFloat(res.cummulativeQuoteQty || '0') || (sellAmount * avgPrice),
            commission: res.fills ? res.fills.reduce((sum: number, f: { commission?: string }) => sum + parseFloat(f.commission || '0'), 0) : 0,
            commission_asset: (res.fills && res.fills[0]) ? res.fills[0].commissionAsset : undefined,
            profit_loss: profitLoss,
            profit_loss_percentage: profitLossPercentage
        });

        await calculateDailyPerformance();

        return { ok: true, dbId, raw: res, profitLoss, profitLossPercentage };
    } catch (error: unknown) {
        console.error('Sell signal failed', error instanceof Error ? error.message : String(error), pair);
        throw error;
    }
}
