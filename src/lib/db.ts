import { sql } from '@/lib/postgres';

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
    meta: Record<string, unknown>;
}

export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    created_at: number;
    updated_at: number;
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
    parameters: Record<string, unknown>;
    active: boolean;
    created_at: number;
    updated_at: number;
}

export interface PerformanceMetrics {
    date: string;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    total_profit_loss: number;
    win_rate: number;
    avg_profit: number;
    avg_loss: number;
    best_trade: number;
    worst_trade: number;
}

export interface BotConfig {
    id: number;
    f4_length: number;
    whale_multiplier: number;
    ai_threshold: number;
    auto_trade: boolean;
    defense_mode: boolean;
    timeframe: string;
    updated_at: number;
}

const DEFAULT_UID = 1;

// --- USER MANAGEMENT ---
export async function createUser(userData: Partial<User>) {
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

export async function updateUser(id: number, updates: Partial<User>) {
    if (updates.password_hash) await sql`UPDATE users SET password_hash = ${updates.password_hash}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

// --- ORDERS ---
export async function insertOrder(obj: Partial<Order>) {
    try {
        const now = Date.now();
        const result = await sql`
            INSERT INTO orders (user_id, mexc_order_id, symbol, side, type, qty, quote, price, status, created_at, updated_at, meta) 
            VALUES (${obj.user_id || null}, ${obj.mexc_order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type}, ${obj.qty || null}, ${obj.quote || null}, ${obj.price || null}, ${obj.status || 'NEW'}, ${now}, ${now}, ${JSON.stringify(obj.meta || {})}) 
            RETURNING id
        `;
        return result.rows[0].id;
    } catch (e: unknown) {
        console.error('DB Insert Order Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

export async function updateOrderStatus(id: number, status: string, meta: Record<string, unknown>) {
    return await sql`UPDATE orders SET status = ${status}, updated_at = ${Date.now()}, meta = ${JSON.stringify(meta || {})} WHERE id = ${id}`;
}

export async function getOpenOrders() {
    const { rows } = await sql`SELECT * FROM orders WHERE status NOT IN ('CLOSED', 'FILLED')`;
    return rows;
}

export async function getAllOrders(limit = 100) {
    const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

export async function getOrderById(id: number) {
    const { rows } = await sql`SELECT * FROM orders WHERE id = ${id}`;
    return rows[0];
}

// --- TRADE HISTORY ---
export async function insertTradeHistory(obj: Partial<Trade>) {
    try {
        const result = await sql`
            INSERT INTO trade_history (order_id, symbol, side, type, qty, price, quote_qty, commission, commission_asset, profit_loss, profit_loss_percentage, created_at) 
            VALUES (${obj.order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type || 'MARKET'}, ${obj.qty}, ${obj.price}, ${obj.quote_qty}, ${obj.commission || 0}, ${obj.commission_asset || null}, ${obj.profit_loss || 0}, ${obj.profit_loss_percentage || 0}, ${Date.now()}) 
            RETURNING id
        `;
        return result.rows[0].id;
    } catch (e: unknown) {
        console.error('DB Insert Trade History Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

export async function getTradeHistory(limit = 100) {
    const { rows } = await sql`SELECT * FROM trade_history ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

export async function getTradeHistoryBySymbol(symbol: string = '', limit = 100) {
    const { rows } = await sql`SELECT * FROM trade_history WHERE symbol = ${symbol} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
}

// --- PORTFOLIO ---
export async function createPortfolioSnapshot(totalValue: number, totalAssets: number, balances: unknown[]) {
    try {
        const result = await sql`INSERT INTO portfolio_snapshots (total_value, total_assets, snapshot_date, balances) VALUES (${totalValue}, ${totalAssets}, ${Date.now()}, ${JSON.stringify(balances)}) RETURNING id`;
        return result.rows[0].id;
    } catch (e: unknown) {
        console.error('DB Create Portfolio Snapshot Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

export async function getPortfolioSnapshots(days = 30) {
    try {
        const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        const { rows } = await sql`SELECT * FROM portfolio_snapshots WHERE snapshot_date >= ${startDate} ORDER BY snapshot_date ASC`;
        return rows;
    } catch (e: unknown) {
        console.error('DB Get Portfolio Snapshots Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

// --- PERFORMANCE ---
export async function updatePerformanceMetrics(date: string, metrics: Partial<PerformanceMetrics>) {
    try {
        await sql`
            INSERT INTO performance_metrics (date, total_trades, winning_trades, losing_trades, total_profit_loss, win_rate, avg_profit, avg_loss, best_trade, worst_trade) 
            VALUES (${date}, ${metrics.total_trades || 0}, ${metrics.winning_trades || 0}, ${metrics.losing_trades || 0}, ${metrics.total_profit_loss || 0}, ${metrics.win_rate || 0}, ${metrics.avg_profit || 0}, ${metrics.avg_loss || 0}, ${metrics.best_trade || 0}, ${metrics.worst_trade || 0}) 
            ON CONFLICT (date) DO UPDATE SET 
            total_trades = EXCLUDED.total_trades, 
            winning_trades = EXCLUDED.winning_trades, 
            losing_trades = EXCLUDED.losing_trades, 
            total_profit_loss = EXCLUDED.total_profit_loss, 
            win_rate = EXCLUDED.win_rate, 
            avg_profit = EXCLUDED.avg_profit, 
            avg_loss = EXCLUDED.avg_loss, 
            best_trade = EXCLUDED.best_trade, 
            worst_trade = EXCLUDED.worst_trade
        `;
    } catch (e: unknown) {
        console.error('DB Update Performance Metrics Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

export async function getPerformanceMetrics(days = 30) {
    try {
        const { rows } = await sql`SELECT * FROM performance_metrics ORDER BY date DESC LIMIT ${days}`;
        return rows;
    } catch (e: unknown) {
        console.error('DB Get Performance Metrics Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

export async function calculateDailyPerformance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = new Date(today).getTime();
        const { rows: trades } = await sql`SELECT * FROM trade_history WHERE created_at >= ${todayStart}`;
        if (trades.length === 0) return null;
        
        const metrics = {
            total_trades: trades.length,
            winning_trades: trades.filter((t) => parseFloat(String(t.profit_loss)) > 0).length,
            losing_trades: trades.filter((t) => parseFloat(String(t.profit_loss)) < 0).length,
            total_profit_loss: trades.reduce((sum: number, t) => sum + parseFloat(String(t.profit_loss || 0)), 0),
            win_rate: 0, 
            avg_profit: 0, 
            avg_loss: 0, 
            best_trade: 0, 
            worst_trade: 0
        };
        
        metrics.win_rate = (metrics.winning_trades / metrics.total_trades) * 100;
        const profits = trades.filter((t) => parseFloat(String(t.profit_loss)) > 0).map((t) => parseFloat(String(t.profit_loss)));
        const losses = trades.filter((t) => parseFloat(String(t.profit_loss)) < 0).map((t) => parseFloat(String(t.profit_loss)));
        
        metrics.avg_profit = profits.length > 0 ? profits.reduce((a: number, b: number) => a + b, 0) / profits.length : 0;
        metrics.avg_loss = losses.length > 0 ? losses.reduce((a: number, b: number) => a + b, 0) / losses.length : 0;
        metrics.best_trade = Math.max(...trades.map((t) => parseFloat(String(t.profit_loss || 0))), 0);
        metrics.worst_trade = Math.min(...trades.map((t) => parseFloat(String(t.profit_loss || 0))), 0);
        
        await updatePerformanceMetrics(today, metrics);
        return metrics;
    } catch (e: unknown) {
        console.error('DB Calculate Daily Performance Error:', e instanceof Error ? e.message : String(e));
        throw e;
    }
}

// --- STRATEGIES ---
export async function createStrategy(strategyData: Partial<Strategy>, userId: number = DEFAULT_UID) {
    const now = Date.now();
    const result = await sql`INSERT INTO strategies (user_id, name, symbol, strategy_type, parameters, active, created_at, updated_at) VALUES (${userId}, ${strategyData.name}, ${strategyData.symbol}, ${strategyData.strategy_type}, ${JSON.stringify(strategyData.parameters || {})}, ${strategyData.active !== undefined ? strategyData.active : true}, ${now}, ${now}) RETURNING id`;
    return result.rows[0].id;
}

export async function getStrategiesByUser(userId: number = DEFAULT_UID): Promise<Strategy[]> {
    const { rows } = await sql`SELECT * FROM strategies WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map((s) => ({ ...s, parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters } as Strategy));
}

export async function getStrategyById(id: number): Promise<Strategy | null> {
    const { rows } = await sql`SELECT * FROM strategies WHERE id = ${id}`;
    if (!rows[0]) return null;
    const strategy = rows[0];
    return { ...strategy, parameters: typeof strategy.parameters === 'string' ? JSON.parse(strategy.parameters) : strategy.parameters } as Strategy;
}

export async function updateStrategy(id: number, updates: Partial<Strategy>) {
    if (updates.active !== undefined) await sql`UPDATE strategies SET active = ${updates.active}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

export async function deleteStrategy(id: number, userId: number = DEFAULT_UID) {
    await sql`DELETE FROM strategies WHERE id = ${id} AND user_id = ${userId}`;
}

export async function createStrategySignal(signalData: { strategy_id: number; signal_type: string; price?: number; volume?: number; timestamp: number; executed?: boolean; execution_result?: unknown }) {
    const result = await sql`INSERT INTO strategy_signals (strategy_id, signal_type, price, volume, timestamp, executed, execution_result) VALUES (${signalData.strategy_id}, ${signalData.signal_type}, ${signalData.price || null}, ${signalData.volume || null}, ${signalData.timestamp}, ${signalData.executed || false}, ${signalData.execution_result ? JSON.stringify(signalData.execution_result) : null}) RETURNING id`;
    return result.rows[0].id;
}

export async function getStrategySignals(strategyId: number, limit = 100) {
    const { rows } = await sql`SELECT * FROM strategy_signals WHERE strategy_id = ${strategyId} ORDER BY timestamp DESC LIMIT ${limit}`;
    return rows.map((s) => ({ ...s, execution_result: s.execution_result ? JSON.parse(s.execution_result) : null }));
}

// --- BOT CONFIG ---
export async function getBotConfig(): Promise<BotConfig> {
    const { rows } = await sql`SELECT * FROM bot_configs WHERE id = 1`;
    if (!rows[0]) {
        return {
            id: 1,
            f4_length: 10,
            whale_multiplier: 1.8,
            ai_threshold: 65,
            auto_trade: false,
            defense_mode: false,
            timeframe: '4h',
            updated_at: Date.now()
        } as BotConfig;
    }
    return rows[0] as BotConfig;
}

export async function updateBotConfig(updates: Partial<BotConfig>) {
    try {
        const current = await getBotConfig();
        
        // Ensure strictly numbers for numeric fields
        const f4 = parseInt(String(updates.f4_length !== undefined ? updates.f4_length : (current.f4_length ?? 10)));
        const whale = parseFloat(String(updates.whale_multiplier !== undefined ? updates.whale_multiplier : (current.whale_multiplier ?? 1.8)));
        const ai = parseInt(String(updates.ai_threshold !== undefined ? updates.ai_threshold : (current.ai_threshold ?? 65)));
        
        const auto = !!(updates.auto_trade !== undefined ? updates.auto_trade : (current.auto_trade ?? false));
        const defense = !!(updates.defense_mode !== undefined ? updates.defense_mode : (current.defense_mode ?? false));
        const timeframe = String(updates.timeframe !== undefined ? updates.timeframe : (current.timeframe ?? '4h'));
        const now = Date.now();

        await sql`
            INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, timeframe, updated_at)
            VALUES (1, ${f4}, ${whale}, ${ai}, ${auto}, ${defense}, ${timeframe}, ${now})
            ON CONFLICT (id) DO UPDATE SET
                f4_length = EXCLUDED.f4_length,
                whale_multiplier = EXCLUDED.whale_multiplier,
                ai_threshold = EXCLUDED.ai_threshold,
                auto_trade = EXCLUDED.auto_trade,
                defense_mode = EXCLUDED.defense_mode,
                timeframe = EXCLUDED.timeframe,
                updated_at = EXCLUDED.updated_at
        `;
    } catch (err: unknown) {
        console.error('DB Update Bot Config Error:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
