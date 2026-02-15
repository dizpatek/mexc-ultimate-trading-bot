import { sql } from '@vercel/postgres';

export interface Order {
    id: number;
    user_id?: number;
    mexc_order_id?: string;
    symbol: string;
    side: string;
    type: string;
    qty?: number;
    quote?: number;
    price?: number;
    status: string;
    created_at: number;
    updated_at: number;
    meta: any;
}

export interface Trade {
    id: number;
    user_id?: number;
    order_id?: number;
    symbol: string;
    side: string;
    type: string;
    qty: number;
    price: number;
    quote_qty: number;
    commission: number;
    commission_asset?: string;
    profit_loss: number;
    profit_loss_percentage: number;
    created_at: number;
}

export interface Strategy {
    id: number;
    user_id: number;
    name: string;
    symbol: string;
    strategy_type: string;
    parameters: any;
    active: boolean;
    created_at: number;
    updated_at: number;
}

const DEFAULT_UID = 1;

// --- USER MANAGEMENT ---
export async function createUser(userData: any) {
    const now = Date.now();
    const result = await sql`INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (${userData.username}, ${userData.email}, ${userData.password_hash}, ${now}, ${now}) RETURNING id`;
    return result.rows[0].id;
}

export async function getUserById(id: number) {
    const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
    return rows[0];
}

export async function getUserByEmail(email: string) {
    const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
    return rows[0];
}

export async function getUserByUsername(username: string) {
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
    return rows[0];
}

export async function updateUser(id: number, updates: any) {
    if (updates.password_hash) await sql`UPDATE users SET password_hash = ${updates.password_hash}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

// --- ORDERS ---
export async function insertOrder(obj: Partial<Order>, userId: number = DEFAULT_UID) {
    const now = Date.now();
    const result = await sql`INSERT INTO orders (user_id, mexc_order_id, symbol, side, type, qty, quote, price, status, created_at, updated_at, meta) VALUES (${userId}, ${obj.mexc_order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type}, ${obj.qty || null}, ${obj.quote || null}, ${obj.price || null}, ${obj.status || 'NEW'}, ${now}, ${now}, ${JSON.stringify(obj.meta || {})}) RETURNING id`;
    return result.rows[0].id;
}

export async function updateOrderStatus(id: number, status: string, meta: any) {
    return await sql`UPDATE orders SET status = ${status}, updated_at = ${Date.now()}, meta = ${JSON.stringify(meta || {})} WHERE id = ${id}`;
}

export async function getOpenOrders(userId: number = DEFAULT_UID) {
    const { rows } = await sql`SELECT * FROM orders WHERE user_id = ${userId} AND status NOT IN ('CLOSED', 'FILLED')`;
    return rows;
}

export async function getAllOrders(limit = 100, userId: number = DEFAULT_UID) {
    const { rows } = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

export async function getOrderById(id: number) {
    const { rows } = await sql`SELECT * FROM orders WHERE id = ${id}`;
    return rows[0];
}

// --- TRADE HISTORY ---
export async function insertTradeHistory(obj: Partial<Trade>, userId: number = DEFAULT_UID) {
    const result = await sql`INSERT INTO trade_history (user_id, order_id, symbol, side, type, qty, price, quote_qty, commission, commission_asset, profit_loss, profit_loss_percentage, created_at) VALUES (${userId}, ${obj.order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type || 'MARKET'}, ${obj.qty}, ${obj.price}, ${obj.quote_qty}, ${obj.commission || 0}, ${obj.commission_asset || null}, ${obj.profit_loss || 0}, ${obj.profit_loss_percentage || 0}, ${Date.now()}) RETURNING id`;
    return result.rows[0].id;
}

export async function getTradeHistory(limit = 100, userId: number = DEFAULT_UID) {
    const { rows } = await sql`SELECT * FROM trade_history WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

export async function getTradeHistoryBySymbol(symbol: string = '', limit = 100, userId: number = DEFAULT_UID) {
    const { rows } = await sql`SELECT * FROM trade_history WHERE user_id = ${userId} AND symbol = ${symbol} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

// --- PORTFOLIO ---
export async function createPortfolioSnapshot(totalValue: number, totalAssets: number, balances: any[], userId: number = DEFAULT_UID) {
    const result = await sql`INSERT INTO portfolio_snapshots (user_id, total_value, total_assets, snapshot_date, balances) VALUES (${userId}, ${totalValue}, ${totalAssets}, ${Date.now()}, ${JSON.stringify(balances)}) RETURNING id`;
    return result.rows[0].id;
}

export async function getPortfolioSnapshots(userId: number = DEFAULT_UID, days = 30) {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const { rows } = await sql`SELECT * FROM portfolio_snapshots WHERE user_id = ${userId} AND snapshot_date >= ${startDate} ORDER BY snapshot_date ASC`;
    return rows;
}

// --- PERFORMANCE ---
export async function updatePerformanceMetrics(date: string, metrics: any, userId: number = DEFAULT_UID) {
    await sql`INSERT INTO performance_metrics (user_id, date, total_trades, winning_trades, losing_trades, total_profit_loss, win_rate, avg_profit, avg_loss, best_trade, worst_trade) VALUES (${userId}, ${date}, ${metrics.total_trades || 0}, ${metrics.winning_trades || 0}, ${metrics.losing_trades || 0}, ${metrics.total_profit_loss || 0}, ${metrics.win_rate || 0}, ${metrics.avg_profit || 0}, ${metrics.avg_loss || 0}, ${metrics.best_trade || 0}, ${metrics.worst_trade || 0}) ON CONFLICT (user_id, date) DO UPDATE SET total_trades = EXCLUDED.total_trades, winning_trades = EXCLUDED.winning_trades, losing_trades = EXCLUDED.losing_trades, total_profit_loss = EXCLUDED.total_profit_loss, win_rate = EXCLUDED.win_rate, avg_profit = EXCLUDED.avg_profit, avg_loss = EXCLUDED.avg_loss, best_trade = EXCLUDED.best_trade, worst_trade = EXCLUDED.worst_trade`;
}

export async function getPerformanceMetrics(days = 30, userId: number = DEFAULT_UID) {
    const { rows } = await sql`SELECT * FROM performance_metrics WHERE user_id = ${userId} ORDER BY date DESC LIMIT ${days}`;
    return rows;
}

export async function calculateDailyPerformance(userId: number = DEFAULT_UID) {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).getTime();
    const { rows: trades } = await sql`SELECT * FROM trade_history WHERE user_id = ${userId} AND created_at >= ${todayStart}`;
    if (trades.length === 0) return null;
    const metrics = {
        total_trades: trades.length,
        winning_trades: trades.filter((t: any) => parseFloat(t.profit_loss) > 0).length,
        losing_trades: trades.filter((t: any) => parseFloat(t.profit_loss) < 0).length,
        total_profit_loss: trades.reduce((sum: number, t: any) => sum + parseFloat(t.profit_loss || 0), 0),
        win_rate: 0, avg_profit: 0, avg_loss: 0, best_trade: 0, worst_trade: 0
    };
    metrics.win_rate = (metrics.winning_trades / metrics.total_trades) * 100;
    const profits = trades.filter((t: any) => parseFloat(t.profit_loss) > 0).map((t: any) => parseFloat(t.profit_loss));
    const losses = trades.filter((t: any) => parseFloat(t.profit_loss) < 0).map((t: any) => parseFloat(t.profit_loss));
    metrics.avg_profit = profits.length > 0 ? profits.reduce((a: number, b: number) => a + b, 0) / profits.length : 0;
    metrics.avg_loss = losses.length > 0 ? losses.reduce((a: number, b: number) => a + b, 0) / losses.length : 0;
    metrics.best_trade = Math.max(...trades.map((t: any) => parseFloat(t.profit_loss || 0)), 0);
    metrics.worst_trade = Math.min(...trades.map((t: any) => parseFloat(t.profit_loss || 0)), 0);
    await updatePerformanceMetrics(today, metrics, userId);
    return metrics;
}

// --- STRATEGIES ---
export async function createStrategy(strategyData: any, userId: number = DEFAULT_UID) {
    const now = Date.now();
    const result = await sql`INSERT INTO strategies (user_id, name, symbol, strategy_type, parameters, active, created_at, updated_at) VALUES (${userId}, ${strategyData.name}, ${strategyData.symbol}, ${strategyData.strategy_type}, ${JSON.stringify(strategyData.parameters || {})}, ${strategyData.active !== undefined ? strategyData.active : true}, ${now}, ${now}) RETURNING id`;
    return result.rows[0].id;
}

export async function getStrategiesByUser(userId: number = DEFAULT_UID): Promise<Strategy[]> {
    const { rows } = await sql`SELECT * FROM strategies WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((s: any) => ({ ...s, parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters }));
}

export async function getStrategyById(id: number): Promise<Strategy | null> {
    const { rows } = await sql`SELECT * FROM strategies WHERE id = ${id}`;
    if (!rows[0]) return null;
    const strategy = rows[0];
    return { ...strategy, parameters: typeof strategy.parameters === 'string' ? JSON.parse(strategy.parameters) : strategy.parameters } as Strategy;
}

export async function updateStrategy(id: number, updates: any) {
    if (updates.active !== undefined) await sql`UPDATE strategies SET active = ${updates.active}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

export async function deleteStrategy(id: number, userId: number = DEFAULT_UID) {
    await sql`DELETE FROM strategies WHERE id = ${id} AND user_id = ${userId}`;
}

export async function createStrategySignal(signalData: any) {
    const result = await sql`INSERT INTO strategy_signals (strategy_id, signal_type, price, volume, timestamp, executed, execution_result) VALUES (${signalData.strategy_id}, ${signalData.signal_type}, ${signalData.price || null}, ${signalData.volume || null}, ${signalData.timestamp}, ${signalData.executed || false}, ${signalData.execution_result ? JSON.stringify(signalData.execution_result) : null}) RETURNING id`;
    return result.rows[0].id;
}

export async function getStrategySignals(strategyId: number, limit = 100) {
    const { rows } = await sql`SELECT * FROM strategy_signals WHERE strategy_id = ${strategyId} ORDER BY timestamp DESC LIMIT ${limit}`;
    return rows.map((s: any) => ({ ...s, execution_result: s.execution_result ? JSON.parse(s.execution_result) : null }));
}
