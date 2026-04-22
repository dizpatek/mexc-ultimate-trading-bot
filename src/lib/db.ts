import { sql, pool } from "@/lib/postgres";
import { TelegramService } from "./telegram-service";
export { sql, pool };
import { DEFAULT_BOT_CONFIG } from "./constants/bot-defaults";
import type { Pool } from "pg";

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
  trading_mode?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_admin?: boolean;
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

export interface MarketTrade {
  symbol: string;
  exchange: string;
  t: number;
  p: number;
  q: number;
  side: number;
  usd: number;
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

export interface BotTimeframeSettings {
  tradeMode?: "Scalp" | "Swing";
  pilot_trade_allocation?: number;
  pilot_tp_percent?: number;
  pilot_sl_percent?: number;
  cover_tp_percent?: number;
  cover_sl_percent?: number;
  cover_tp_trailing?: boolean;
  cover_tp_deviation?: number;
  cover_sl_trailing?: boolean;
  cover_sl_deviation?: number;
  pilot_tp_trailing?: boolean;
  pilot_tp_deviation?: number;
  pilot_sl_trailing?: boolean;
  pilot_sl_deviation?: number;
  pilot_mode?: "matrix" | "hedge";
  pilot_use_usdt?: boolean;
  pilot_trailing_buy?: boolean;
  pilot_trailing_buy_dev?: number;
  // AutoResearch Preferences
  ar_symbols?: string[];
  ar_timeframe?: string;
  ar_is_running?: boolean;
  ar_phase?: "auto" | "random" | "hillclimb" | "ucb";
  [key: string]: unknown;
}

export interface BotConfig {
  id: number;
  f4_length: number;
  whale_multiplier: number;
  ai_threshold: number;
  auto_trade: boolean;
  defense_mode: boolean;
  pilot_trailing_buy: boolean;
  pilot_trailing_buy_dev: number;
  pilot_tp_trailing: boolean;
  pilot_tp_deviation: number;
  pilot_sl_trailing: boolean;
  pilot_sl_deviation: number;
  pilot_timeframe: string;
  pilot_mtf_veto: boolean;
  pilot_mtf_threshold: number;
  pilot_mtf_long_threshold: number;
  pilot_mtf_short_threshold: number;
  pilot_only_holdings: boolean;
  pilot_mode: "matrix" | "hedge";
  pilot_use_usdt: boolean;
  f4_multiplier: number;
  scalp_f4_multiplier?: number;  // Scalp TF'leri (1m-4h) için F4 çarpanı
  swing_f4_multiplier?: number;  // Swing TF'leri (1d+) için F4 çarpanı
  f4_alpha?: number;             // F4 alpha (0-100 arası, motora /100 olarak geçilir)
  f4_power_loss_threshold: number;
  f4_lookback_bars: number;
  f4_squeeze_threshold: number;
  long_squeeze_threshold: number;
  short_squeeze_threshold: number;
  f4_slope_threshold: number;
  min_power_loss: number;
  trade_freshness_bars: number;
  fibo_length: number;
  scalp_length?: number;
  scalp_volume_multiplier?: number;
  swing_length?: number;
  swing_volume_multiplier?: number;
  updated_at: number;
  timeframe_settings: BotTimeframeSettings;
  // Root-level pilot trade/cover values (AutoResearch optimize eder, root kolona yazar)
  pilot_tp_percent?: number;
  pilot_sl_percent?: number;
  // V2.1 Engine Overrides (AutoResearch optimize eder)
  rsi_period?: number;
  rsi_ob?: number;
  rsi_os?: number;
  adx_threshold?: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  stoch_rsi_len?: number;
}

// @eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveTradeMode(botConfig: BotConfig | null | undefined): "Scalp" | "Swing" {
  try {
    const tfSettings = (typeof botConfig?.timeframe_settings === "object" && botConfig?.timeframe_settings) || {};
    const mode = tfSettings.tradeMode;
    if (mode === "Swing") return "Swing";
    return "Scalp";
  } catch {
    return "Scalp";
  }
}

const DEFAULT_UID = 1;

// --- USER MANAGEMENT ---
export async function createUser(userData: Partial<User>) {
  const now = Date.now();
  const result =
    await sql`INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (${userData.username}, ${userData.email}, ${userData.password_hash}, ${now}, ${now}) RETURNING id`;
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

export async function getAllUserIds(): Promise<number[]> {
  const { rows } = await sql`SELECT id FROM users`;
  return rows.map(r => Number(r.id));
}

export async function getUserByUsername(username: string) {
  const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
  return rows[0];
}

export async function updateUser(id: number, updates: Partial<User>) {
  if (updates.password_hash)
    await sql`UPDATE users SET password_hash = ${updates.password_hash}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

// --- ORDERS ---
export async function insertOrder(obj: Partial<Order>) {
  try {
    const now = Date.now();
    const result = await sql`
            INSERT INTO orders (user_id, mexc_order_id, symbol, side, type, qty, quote, price, status, created_at, updated_at, meta, trading_mode) 
            VALUES (${obj.user_id || DEFAULT_UID}, ${obj.mexc_order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type}, ${obj.qty !== undefined ? obj.qty : null}, ${obj.quote !== undefined ? obj.quote : null}, ${obj.price !== undefined ? obj.price : null}, ${obj.status || "NEW"}, ${now}, ${now}, ${JSON.stringify(obj.meta || {})}::jsonb, ${obj.trading_mode || "test"}) 
            RETURNING id
        `;
    return result.rows[0].id;
  } catch (e: unknown) {
    console.error(
      "DB Insert Order Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

export async function updateOrderStatus(
  id: number,
  status: string,
  meta: Record<string, unknown>,
) {
  return await sql`UPDATE orders SET status = ${status}, updated_at = ${Date.now()}, meta = ${JSON.stringify(meta || {})}::jsonb WHERE id = ${id}`;
}

export async function getOpenOrders() {
  const { rows } =
    await sql`SELECT * FROM orders WHERE status NOT IN ('CLOSED', 'FILLED')`;
  return rows;
}

export async function getActiveOrderSymbols(userId: number, tradingMode: string = "test"): Promise<string[]> {
  const { rows } = await sql`
        SELECT DISTINCT symbol FROM orders 
        WHERE user_id = ${userId} 
        AND trading_mode = ${tradingMode} 
        AND status NOT IN ('CLOSED', 'CANCELED', 'REJECTED')
        AND (status != 'FILLED' OR meta::jsonb->>'smartTrade' = 'true')
    `;
  return rows.map(r => r.symbol as string);
}

export async function getActiveSmartTrades(userId: number, tradingMode: string = "test"): Promise<any[]> {
  const { rows } = await sql`
        SELECT * FROM orders 
        WHERE user_id = ${userId} 
        AND trading_mode = ${tradingMode} 
        AND status NOT IN ('CLOSED', 'CANCELED', 'REJECTED')
        AND meta::jsonb->>'smartTrade' = 'true'
    `;
  return rows.map(r => ({
    ...r,
    meta: typeof r.meta === "string" ? JSON.parse(r.meta) : (r.meta || {})
  }));
}

export async function getAllOrders(limit = 100) {
  const { rows } =
    await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit}`;
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
            INSERT INTO trade_history (user_id, order_id, symbol, side, type, qty, price, quote_qty, commission, commission_asset, profit_loss, profit_loss_percentage, created_at) 
            VALUES (${obj.user_id || DEFAULT_UID}, ${obj.order_id || null}, ${obj.symbol}, ${obj.side}, ${obj.type || "MARKET"}, ${obj.qty}, ${obj.price}, ${obj.quote_qty}, ${obj.commission || 0}, ${obj.commission_asset || null}, ${obj.profit_loss || 0}, ${obj.profit_loss_percentage || 0}, ${Date.now()}) 
            RETURNING id
        `;
    return result.rows[0].id;
  } catch (e: unknown) {
    console.error(
      "DB Insert Trade History Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

export async function getTradeHistory(userId: number, limit = 100, mode = "test") {
  const { rows } =
    await sql`SELECT * FROM trade_history WHERE user_id = ${userId} AND trading_mode = ${mode} ORDER BY created_at DESC LIMIT ${limit}`;
  return rows;
}

export async function getTradeHistoryBySymbol(
  userId: number,
  symbol: string = "",
  limit = 100,
) {
  const { rows } =
    await sql`SELECT * FROM trade_history WHERE user_id = ${userId} AND symbol = ${symbol} ORDER BY created_at DESC LIMIT ${limit}`;
  return rows;
}

// --- MARKET DATA CACHING ---
export async function getMarketTrades(symbol: string, exchange: string, from: number, to: number): Promise<MarketTrade[]> {
  const { rows } = await sql`
        SELECT symbol, exchange, t, p, q, side, usd 
        FROM market_trades 
        WHERE symbol = ${symbol} AND exchange = ${exchange} AND t >= ${from} AND t <= ${to} 
        ORDER BY t ASC
    `;
  return rows.map(r => ({
    symbol: r.symbol as string,
    exchange: r.exchange as string,
    t: Number(r.t),
    p: Number(r.p),
    q: Number(r.q),
    side: Number(r.side),
    usd: Number(r.usd)
  }));
}

export async function getLatestMarketTrade(symbol: string, exchange: string): Promise<MarketTrade | null> {
  const { rows } = await sql`
        SELECT symbol, exchange, t, p, q, side, usd 
        FROM market_trades 
        WHERE symbol = ${symbol} AND exchange = ${exchange}
        ORDER BY t DESC
        LIMIT 1
    `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    symbol: r.symbol as string,
    exchange: r.exchange as string,
    t: Number(r.t),
    p: Number(r.p),
    q: Number(r.q),
    side: Number(r.side),
    usd: Number(r.usd)
  };
}

export async function insertMarketTrades(trades: MarketTrade[]) {
  if (trades.length === 0) return;
  
  // P4.3: CHUNK the bulk insert to prevent Postgres bind parameter limits (Max ~65k)
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
    const chunk = trades.slice(i, i + CHUNK_SIZE);
    const query = `
      INSERT INTO market_trades (symbol, exchange, t, p, q, side, usd)
      VALUES ${chunk.map((_, j) => `($${j*7+1}, $${j*7+2}, $${j*7+3}, $${j*7+4}, $${j*7+5}, $${j*7+6}, $${j*7+7})`).join(',')}
      ON CONFLICT (symbol, exchange, t, p, q, side) DO NOTHING
    `;
    const values = chunk.flatMap(tr => [tr.symbol, tr.exchange, tr.t, tr.p, tr.q, tr.side, tr.usd]);
    await pool.query(query, values);
  }
}

// --- NEWS ---
export async function getRecentNews(limit = 200, hours = 24): Promise<any[]> {
  const cutoff = Math.floor(Date.now() / 1000) - (hours * 3600);
  const { rows } = await sql`
        SELECT * FROM news 
        WHERE published_on > ${cutoff} 
        ORDER BY published_on DESC 
        LIMIT ${limit}
    `;
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    translatedTitle: r.translated_title,
    excerpt: r.excerpt,
    source: r.source,
    time: r.time,
    url: r.url,
    imageUrl: r.image_url,
    publishedOn: Number(r.published_on)
  }));
}

export async function insertNewsBulk(news: any[]) {
  if (news.length === 0) return;
  
  // P4.3: DE-DUPLICATE within the incoming array by both ID and URL to avoid 
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" in Postgres.
  const uniqueById = new Map(news.map(n => [n.id, n]));
  const uniqueByUrl = new Map(Array.from(uniqueById.values()).map(n => [n.url, n]));
  const uniqueNews = Array.from(uniqueByUrl.values());
  
  const query = `
    INSERT INTO news (id, title, translated_title, excerpt, source, time, url, image_url, published_on, created_at)
    VALUES ${uniqueNews.map((_, i) => `($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})`).join(',')}
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      translated_title = EXCLUDED.translated_title,
      excerpt = EXCLUDED.excerpt,
      time = EXCLUDED.time,
      published_on = EXCLUDED.published_on
  `;
  
  const now = Date.now();
  const values = uniqueNews.flatMap(n => [
    n.id, n.title, n.translatedTitle || null, n.excerpt || null, 
    n.source, n.time || null, n.url, n.imageUrl || null, 
    n.publishedOn, now
  ]);
  
  await pool.query(query, values);
}

// --- PORTFOLIO ---
export async function createPortfolioSnapshot(
  userId: number,
  totalValue: number,
  totalAssets: number,
  balances: unknown[],
) {
  try {
    const result =
      await sql`INSERT INTO portfolio_snapshots (user_id, total_value, total_assets, snapshot_date, balances) VALUES (${userId}, ${totalValue}, ${totalAssets}, ${Date.now()}, ${JSON.stringify(balances)}) RETURNING id`;
    return result.rows[0].id;
  } catch (e: unknown) {
    console.error(
      "DB Create Portfolio Snapshot Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

export async function getPortfolioSnapshots(userId: number, days = 30) {
  try {
    const startDate = Date.now() - days * 24 * 60 * 60 * 1000;
    const { rows } =
      await sql`SELECT * FROM portfolio_snapshots WHERE user_id = ${userId} AND snapshot_date >= ${startDate} ORDER BY snapshot_date ASC`;
    return rows;
  } catch (e: unknown) {
    console.error(
      "DB Get Portfolio Snapshots Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

// --- PERFORMANCE ---
export async function updatePerformanceMetrics(
  userId: number,
  date: string,
  metrics: Partial<PerformanceMetrics>,
) {
  try {
    await sql`
            INSERT INTO performance_metrics (user_id, date, total_trades, winning_trades, losing_trades, total_profit_loss, win_rate, avg_profit, avg_loss, best_trade, worst_trade) 
            VALUES (${userId}, ${date}, ${metrics.total_trades || 0}, ${metrics.winning_trades || 0}, ${metrics.losing_trades || 0}, ${metrics.total_profit_loss || 0}, ${metrics.win_rate || 0}, ${metrics.avg_profit || 0}, ${metrics.avg_loss || 0}, ${metrics.best_trade || 0}, ${metrics.worst_trade || 0}) 
            ON CONFLICT (user_id, date) DO UPDATE SET 
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
    console.error(
      "DB Update Performance Metrics Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

export async function getPerformanceMetrics(userId: number, days = 30) {
  try {
    const { rows } =
      await sql`SELECT * FROM performance_metrics WHERE user_id = ${userId} ORDER BY date DESC LIMIT ${days}`;
    return rows;
  } catch (e: unknown) {
    console.error(
      "DB Get Performance Metrics Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

export async function calculateDailyPerformance(userId: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const todayStart = new Date(today).getTime();
    const { rows: trades } =
      await sql`SELECT * FROM trade_history WHERE user_id = ${userId} AND created_at >= ${todayStart}`;
    if (trades.length === 0) return null;

    const metrics = {
      total_trades: trades.length,
      winning_trades: trades.filter(
        (t) => parseFloat(String(t.profit_loss)) > 0,
      ).length,
      losing_trades: trades.filter((t) => parseFloat(String(t.profit_loss)) < 0)
        .length,
      total_profit_loss: trades.reduce(
        (sum: number, t) => sum + parseFloat(String(t.profit_loss || 0)),
        0,
      ),
      win_rate: 0,
      avg_profit: 0,
      avg_loss: 0,
      best_trade: 0,
      worst_trade: 0,
    };

    metrics.win_rate = (metrics.winning_trades / metrics.total_trades) * 100;
    const profits = trades
      .filter((t) => parseFloat(String(t.profit_loss)) > 0)
      .map((t) => parseFloat(String(t.profit_loss)));
    const losses = trades
      .filter((t) => parseFloat(String(t.profit_loss)) < 0)
      .map((t) => parseFloat(String(t.profit_loss)));

    metrics.avg_profit =
      profits.length > 0
        ? profits.reduce((a: number, b: number) => a + b, 0) / profits.length
        : 0;
    metrics.avg_loss =
      losses.length > 0
        ? losses.reduce((a: number, b: number) => a + b, 0) / losses.length
        : 0;
    metrics.best_trade = Math.max(
      ...trades.map((t) => parseFloat(String(t.profit_loss || 0))),
      0,
    );
    metrics.worst_trade = Math.min(
      ...trades.map((t) => parseFloat(String(t.profit_loss || 0))),
      0,
    );

    await updatePerformanceMetrics(userId, today, metrics);
    return metrics;
  } catch (e: unknown) {
    console.error(
      "DB Calculate Daily Performance Error:",
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

// --- STRATEGIES ---
export async function createStrategy(
  strategyData: Partial<Strategy>,
  userId: number = DEFAULT_UID,
) {
  const now = Date.now();
  const result =
    await sql`INSERT INTO strategies (user_id, name, symbol, strategy_type, parameters, active, created_at, updated_at) VALUES (${userId}, ${strategyData.name}, ${strategyData.symbol}, ${strategyData.strategy_type}, ${JSON.stringify(strategyData.parameters || {})}, ${strategyData.active !== undefined ? strategyData.active : true}, ${now}, ${now}) RETURNING id`;
  return result.rows[0].id;
}

export async function getStrategiesByUser(
  userId: number = DEFAULT_UID,
): Promise<Strategy[]> {
  const { rows } =
    await sql`SELECT * FROM strategies WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map(
    (s) =>
      ({
        ...s,
        parameters:
          typeof s.parameters === "string"
            ? JSON.parse(s.parameters)
            : s.parameters,
      }) as Strategy,
  );
}

export async function getStrategyById(id: number): Promise<Strategy | null> {
  const { rows } = await sql`SELECT * FROM strategies WHERE id = ${id}`;
  if (!rows[0]) return null;
  const strategy = rows[0];
  return {
    ...strategy,
    parameters:
      typeof strategy.parameters === "string"
        ? JSON.parse(strategy.parameters)
        : strategy.parameters,
  } as Strategy;
}

export async function updateStrategy(id: number, updates: Partial<Strategy>) {
  if (updates.active !== undefined)
    await sql`UPDATE strategies SET active = ${updates.active}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

export async function deleteStrategy(id: number, userId: number = DEFAULT_UID) {
  await sql`DELETE FROM strategies WHERE id = ${id} AND user_id = ${userId}`;
}

export interface StrategySignalInput {
  strategy_id?: number | null;
  symbol: string;
  side: string;
  signal_type: string;
  price: number;
  volume?: number;
  timestamp: number;
  executed: boolean;
  execution_result: Record<string, unknown>;
  veto_reason?: string | null;
  timeframe?: string;
  trading_mode?: string;
  payload?: any;
}

export async function createStrategySignalsBulk(
  signals: StrategySignalInput[],
  userId: number
) {
  if (signals.length === 0) return;

  const placeholders = signals
    .map(
      (_, i) =>
        `($${i * 14 + 1}, $${i * 14 + 2}, $${i * 14 + 3}, $${i * 14 + 4}, $${i * 14 + 5}, $${i * 14 + 6}, $${i * 14 + 7}, $${i * 14 + 8}, $${i * 14 + 9}, $${i * 14 + 10}, $${i * 14 + 11}, $${i * 14 + 12}, $${i * 14 + 13}, $${i * 14 + 14})`,
    )
    .join(",");

  const values = signals.flatMap((s) => [
    userId,
    s.strategy_id || null,
    s.symbol || null,
    s.side || null,
    s.signal_type || "NONE",
    s.price ?? null,
    s.volume ?? null,
    s.timestamp,
    s.executed || false,
    typeof s.execution_result === 'object' ? JSON.stringify(s.execution_result) : (s.execution_result || null),
    s.trading_mode || "test",
    s.timeframe || null,
    s.veto_reason || null,
    s.payload ? JSON.stringify(s.payload) : null,
  ]);

  const query = `
    INSERT INTO strategy_signals (user_id, strategy_id, symbol, side, signal_type, price, volume, timestamp, executed, execution_result, trading_mode, timeframe, veto_reason, payload)
    VALUES ${placeholders}
  `;

  await pool.query(query, values);
}

export async function createStrategySignal(signalData: {
  user_id: number;
  strategy_id?: number;
  symbol?: string;
  side?: string;
  signal_type: string;
  price?: number;
  volume?: number;
  timestamp: number;
  executed?: boolean;
  execution_result?: unknown;
  trading_mode?: string;
  timeframe?: string;
  veto_reason?: string;
  payload?: any;
}) {
  const {
    user_id,
    strategy_id,
    symbol,
    signal_type,
    price,
    volume,
    timestamp,
    executed,
    execution_result,
    trading_mode,
    timeframe,
    veto_reason,
    side,
    payload,
  } = signalData;
  const { rows } = await sql`
        INSERT INTO strategy_signals (user_id, strategy_id, symbol, side, signal_type, price, volume, timestamp, executed, execution_result, trading_mode, timeframe, veto_reason, payload)
        VALUES (${user_id}, ${strategy_id || null}, ${symbol || null}, ${side || null}, ${signal_type || 'NONE'}, ${price ?? null}, ${volume ?? null}, ${timestamp}, ${executed || false}, ${JSON.stringify(execution_result || {})}, ${trading_mode || "test"}, ${timeframe || "1m"}, ${veto_reason || null}, ${JSON.stringify(payload || {})}::jsonb)
        RETURNING id
    `;
  return rows[0].id;
}

/**
 * Marks a strategy signal as executed in the DB.
 * Critical for the pilot pipeline: prevents the same signal from re-appearing
 * in the toast auto-approve loop. Called after successful order creation.
 */
export async function markSignalExecuted(
  signalId: number,
  result: Record<string, unknown> = {},
) {
  await sql`
    UPDATE strategy_signals
    SET executed = true, execution_result = ${JSON.stringify(result)}
    WHERE id = ${signalId}
  `;
}

export async function getStrategySignals(strategyId: number, limit = 100) {
  const { rows } =
    await sql`SELECT * FROM strategy_signals WHERE strategy_id = ${strategyId} ORDER BY timestamp DESC LIMIT ${limit}`;
  return rows.map((s) => ({
    ...s,
    execution_result: typeof s.execution_result === "string"
      ? JSON.parse(s.execution_result)
      : s.execution_result,
  }));
}

export async function getRecentSignalsBulk(
  userId: number,
  symbols: string[],
  windowMs: number,
  tradingMode: string = "test",
): Promise<Array<{ symbol: string; signal_type: string; timeframe: string; executed: boolean }>> {
  if (symbols.length === 0) return [];
  const cutoff = Date.now() - windowMs;
  const { rows } = await (pool as Pool).query(
    `
        SELECT symbol, signal_type, timeframe, executed FROM strategy_signals 
        WHERE user_id = $1 AND symbol = ANY($2) AND timestamp > $3 AND (trading_mode = $4 OR trading_mode IS NULL)
    `,
    [userId, symbols, cutoff, tradingMode],
  );
  return rows;
}

// --- BOT CONFIG ---
export async function getBotConfig(userId: number): Promise<BotConfig> {
  const { rows } = await sql`SELECT * FROM bot_configs WHERE user_id = ${userId}`;
  if (!rows[0]) {
    // Return default but DON'T seed yet (let updateBotConfig handle seeding if user changes something)
    // Or we could seed now if we want.
    return {
      ...DEFAULT_BOT_CONFIG,
      id: 0, // indicates new
      updated_at: Date.now()
    } as BotConfig;
  }
  return {
    ...rows[0],
    whale_multiplier: parseFloat(String(rows[0].whale_multiplier ?? 1.8)),
    ai_threshold: parseInt(String(rows[0].ai_threshold ?? 65)),
    auto_trade: !!rows[0].auto_trade,
    defense_mode: !!rows[0].defense_mode,
    pilot_trailing_buy: !!rows[0].pilot_trailing_buy,
    pilot_tp_trailing: !!rows[0].pilot_tp_trailing,
    pilot_sl_trailing: !!rows[0].pilot_sl_trailing,
    pilot_mtf_veto: !!rows[0].pilot_mtf_veto,
    pilot_mtf_threshold: parseInt(String(rows[0].pilot_mtf_threshold ?? 70)),
    pilot_mtf_long_threshold: parseInt(String(rows[0].pilot_mtf_long_threshold ?? 20)),
    pilot_mtf_short_threshold: parseInt(String(rows[0].pilot_mtf_short_threshold ?? 20)),
    pilot_mode: (rows[0].pilot_mode as any) ?? "matrix",
    pilot_use_usdt: !!rows[0].pilot_use_usdt,
    f4_multiplier: parseFloat(String(rows[0].f4_multiplier ?? 1.0)),
    scalp_f4_multiplier: parseFloat(String(rows[0].scalp_f4_multiplier ?? 3.7)),
    swing_f4_multiplier: parseFloat(String(rows[0].swing_f4_multiplier ?? 1.2)),
    f4_alpha: parseFloat(String(rows[0].f4_alpha ?? 95)),
    f4_power_loss_threshold: parseFloat(String(rows[0].f4_power_loss_threshold ?? 90)),
    long_squeeze_threshold: parseFloat(String(rows[0].long_squeeze_threshold ?? 20)),
    short_squeeze_threshold: parseFloat(String(rows[0].short_squeeze_threshold ?? 20)),
    f4_slope_threshold: parseFloat(String(rows[0].f4_slope_threshold ?? 0.01)),
    scalp_length: parseInt(String(rows[0].scalp_length ?? 11)),
    scalp_volume_multiplier: parseFloat(String(rows[0].scalp_volume_multiplier ?? 3.0)),
    swing_length: parseInt(String(rows[0].swing_length ?? 10)),
    swing_volume_multiplier: parseFloat(String(rows[0].swing_volume_multiplier ?? 1.2)),
    trade_freshness_bars: parseInt(String(rows[0].trade_freshness_bars ?? 5)),
    fibo_length: parseInt(String(rows[0].fibo_length ?? 20)),
    f4_lookback_bars: parseInt(String(rows[0].f4_lookback_bars ?? 30)),
    f4_squeeze_threshold: parseFloat(String(rows[0].f4_squeeze_threshold ?? 20)),
    min_power_loss: parseFloat(String(rows[0].min_power_loss ?? 90)),
    updated_at: Number(rows[0].updated_at || Date.now()),
  } as unknown as BotConfig;
}

// --- System Logging ---
// RAM Optimizasyonu: sysLogBuffer IPTAL EDILDI (Northflank Pico)
// Loglar artik bellekte array olarak birikmeyecek, sadece terminale yazilacak.

export async function flushSystemLogs() {
  // sysLogBuffer iptal edildiği için bu fonksiyon artık boştadır.
  // Eski çağrıların hata vermemesi için korundu.
  return;
}

export async function logSystemEvent(
  userId: number,
  level: string,
  message: string,
  details?: string,
  immediate = false,
) {
  // Console logging (preserved for terminal visibility)
  const timeStr = new Date().toISOString();
  console.log(`[${timeStr}] [UID:${userId}] [${level}] ${message}`, details ? `| Detaylar: ${details}` : "");

  // Database recording (Restored for System Console visibility)
  try {
    await sql`
      INSERT INTO system_logs (user_id, level, message, details, timestamp)
      VALUES (${userId}, ${level}, ${message}, ${details || null}, ${Date.now()})
    `;
  } catch (err) {
    console.error(`[DB] logSystemEvent Failed for User ${userId}:`, err);
  }
}

// --- Autoclean DB Janitor ---
export async function autoCleanDB() {
  try {
    const now = Date.now();
    
    // retention periods (ms)
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    // --- SAFETY VALVE: DISK SPACE MONITORING ---
    const sizeRes = await sql`SELECT pg_database_size(current_database()) as size_bytes, pg_size_pretty(pg_database_size(current_database())) as size_pretty`;
    const sizeBytes = parseInt(String(sizeRes.rows[0].size_bytes));
    const sizePretty = String(sizeRes.rows[0].size_pretty);
    
    const ONE_GB = 1024 * 1024 * 1024;
    const SAFETY_THRESHOLD = 5 * ONE_GB; // 5GB (Limit: 8GB)
    const WARNING_THRESHOLD = 3 * ONE_GB; // 3GB

    console.log(`📊 [DB-Monitor] Mevcut Boyut: ${sizePretty} (${sizeBytes} bytes)`);

    if (sizeBytes > SAFETY_THRESHOLD) {
      console.error(`🚨 [Safety-Valve] KRİTİK DOLULUK TESPİT EDİLDİ (${sizePretty}). Acil tahliye başlatılıyor...`);
      
      // Emergency Truncate
      await sql`TRUNCATE TABLE market_trades;`;
      await sql`TRUNCATE TABLE system_logs;`;
      
      await TelegramService.sendNotification("PANIC", "KRİTİK VERİTABANI DOLULUĞU", 
        `Veritabanı boyutu ${sizePretty} seviyesine ulaştı! Acil durum tahliyesi gerçekleştirildi (market_trades & system_logs temizlendi).`);
    } else if (sizeBytes > WARNING_THRESHOLD) {
      console.warn(`⚠️ [Safety-Valve] Yüksek Doluluk Uyarısı (${sizePretty}).`);
      // Optional: send notification only once every 6 hours for warnings
    }

    // --- STANDARD GRADUATED CLEANUP ---
    // 1. system_logs cleanup (Stratified)
    // Low importance: DEBUG, INFO (8h)
    const resLogsLow = await sql`DELETE FROM system_logs WHERE timestamp < ${now - EIGHT_HOURS} AND level IN ('DEBUG', 'INFO')`;
    // High importance: SYSTEM, ERROR, CRITICAL, ALARM (2 days)
    const resLogsHigh = await sql`DELETE FROM system_logs WHERE timestamp < ${now - TWO_DAYS} AND level IN ('SYSTEM', 'ERROR', 'CRITICAL', 'ALARM')`;
    
    // 2. market_trades cleanup (8 hours - High Volume)
    const resMarket = await sql`DELETE FROM market_trades WHERE t < ${now - EIGHT_HOURS}`;
    
    // 3. strategy_signals cleanup
    // Executed signals: 24h history is enough
    const resSignalsExec = await sql`DELETE FROM strategy_signals WHERE timestamp < ${now - TWENTY_FOUR_HOURS} AND executed = true`;
    // Vetoed or others: 8h
    const resSignalsOther = await sql`DELETE FROM strategy_signals WHERE timestamp < ${now - EIGHT_HOURS} AND executed = false`;

    // 4. trade_history cleanup (30 days)
    const resTrades = await sql`DELETE FROM trade_history WHERE created_at < ${now - THIRTY_DAYS}`;

    // 5. autoresearch_experiments cleanup (Non-best results older than 7 days)
    const resAutoRes = await sql`DELETE FROM autoresearch_experiments WHERE created_at < ${now - SEVEN_DAYS} AND is_best = false`;
    
    const totalDeleted = (resLogsLow.rowCount || 0) + (resLogsHigh.rowCount || 0) + (resMarket.rowCount || 0) + 
                         (resSignalsExec.rowCount || 0) + (resSignalsOther.rowCount || 0) + (resTrades.rowCount || 0) + (resAutoRes.rowCount || 0);

    if (totalDeleted > 0) {
      console.log(`🧹 [Janitor] Veritabanı Temizlendi. Toplam ${totalDeleted} satır silindi.`);
      console.log(`   - Loglar: ${ (resLogsLow.rowCount || 0) + (resLogsHigh.rowCount || 0) } | Market: ${resMarket.rowCount} | Sinyaller: ${ (resSignalsExec.rowCount || 0) + (resSignalsOther.rowCount || 0) }`);
    }
  } catch (err) {
    console.error("🧹 [Janitor] Veritabanı Temizlik Hatasi:", err);
  }
}

// Node.js süreci başlarken bir kez çalıştır ve ardından 1 saatte bir tekrarla
setTimeout(() => {
  autoCleanDB();
  setInterval(autoCleanDB, 1 * 60 * 60 * 1000); // 6 saatten 1 saate düşürüldü
}, 5000);

export async function updateBotConfig(userId: number, updates: Partial<BotConfig>) {
  try {
    const current = await getBotConfig(userId);

    // Ensure strictly numbers for numeric fields
    const f4 = parseInt(
      String(
        updates.f4_length !== undefined
          ? updates.f4_length
          : (current.f4_length ?? 10),
      ),
    );
    const whale = parseFloat(
      String(
        updates.whale_multiplier !== undefined
          ? updates.whale_multiplier
          : (current.whale_multiplier ?? 1.8),
      ),
    );
    const ai = parseInt(
      String(
        updates.ai_threshold !== undefined
          ? updates.ai_threshold
          : (current.ai_threshold ?? 65),
      ),
    );
    const multiplier = parseFloat(
      String(
        updates.f4_multiplier !== undefined
          ? updates.f4_multiplier
          : (current.f4_multiplier ?? 1.2),
      ),
    );

    const auto = !!(updates.auto_trade !== undefined
      ? updates.auto_trade
      : (current.auto_trade ?? false));
    const defense = !!(updates.defense_mode !== undefined
      ? updates.defense_mode
      : (current.defense_mode ?? false));

    const pt_buy = !!(updates.pilot_trailing_buy !== undefined
      ? updates.pilot_trailing_buy
      : (current.pilot_trailing_buy ?? true));
    const pt_buy_dev = parseFloat(
      String(
        updates.pilot_trailing_buy_dev !== undefined
          ? updates.pilot_trailing_buy_dev
          : (current.pilot_trailing_buy_dev ?? 0.3),
      ),
    );
    const pt_tp = !!(updates.pilot_tp_trailing !== undefined
      ? updates.pilot_tp_trailing
      : (current.pilot_tp_trailing ?? true));
    const pt_tp_dev = parseFloat(
      String(
        updates.pilot_tp_deviation !== undefined
          ? updates.pilot_tp_deviation
          : (current.pilot_tp_deviation ?? 1.0),
      ),
    );
    const pt_sl = !!(updates.pilot_sl_trailing !== undefined
      ? updates.pilot_sl_trailing
      : (current.pilot_sl_trailing ?? true));
    const pt_sl_dev = parseFloat(
      String(
        updates.pilot_sl_deviation !== undefined
          ? updates.pilot_sl_deviation
          : (current.pilot_sl_deviation ?? 0.5),
      ),
    );

    const ptf =
      updates.pilot_timeframe !== undefined
        ? String(updates.pilot_timeframe)
        : current.pilot_timeframe || "4h";

    const p_only = !!(updates.pilot_only_holdings !== undefined
      ? updates.pilot_only_holdings
      : (current.pilot_only_holdings ?? false));

    const p_veto = !!(updates.pilot_mtf_veto !== undefined
      ? updates.pilot_mtf_veto
      : (current.pilot_mtf_veto ?? true));
    
    const p_thresh = parseInt(
      String(
        updates.pilot_mtf_threshold !== undefined
          ? updates.pilot_mtf_threshold
          : (current.pilot_mtf_threshold ?? 70),
      ),
    );

    const p_long = parseInt(
      String(
        updates.pilot_mtf_long_threshold !== undefined
          ? updates.pilot_mtf_long_threshold
          : (current.pilot_mtf_long_threshold ?? 20), // YENİ: +20 (eski 70 idi, yeni ölçek -100/+100)
      ),
    );

    const p_short = parseInt(
      String(
        updates.pilot_mtf_short_threshold !== undefined
          ? updates.pilot_mtf_short_threshold
          : (current.pilot_mtf_short_threshold ?? 20), // YENİ: 20 (eski 30 idi, pilot-executor eksi yapıyor: -20)
      ),
    );

    const p_mode = updates.pilot_mode !== undefined
      ? updates.pilot_mode
      : (current.pilot_mode || "matrix");
    
    const p_usdt = !!(updates.pilot_use_usdt !== undefined
      ? updates.pilot_use_usdt
      : (current.pilot_use_usdt ?? false));

    const now = Date.now();

    const configData: Record<string, any> = {
      user_id: userId,
      f4_length: f4,
      whale_multiplier: whale,
      ai_threshold: ai,
      auto_trade: auto,
      defense_mode: defense,
      pilot_trailing_buy: pt_buy,
      pilot_trailing_buy_dev: pt_buy_dev,
      pilot_tp_trailing: pt_tp,
      pilot_tp_deviation: pt_tp_dev,
      pilot_sl_trailing: pt_sl,
      pilot_sl_deviation: pt_sl_dev,
      pilot_timeframe: ptf,
      f4_multiplier: multiplier,
      timeframe_settings: updates.timeframe_settings || current.timeframe_settings || {},
      pilot_only_holdings: p_only,
      f4_power_loss_threshold: updates.f4_power_loss_threshold ?? current.f4_power_loss_threshold ?? 90,
      pilot_mtf_veto: p_veto,
      pilot_mtf_threshold: p_thresh,
      pilot_mtf_long_threshold: p_long,
      pilot_mtf_short_threshold: p_short,
      f4_lookback_bars: updates.f4_lookback_bars ?? current.f4_lookback_bars ?? 30,
      f4_squeeze_threshold: updates.f4_squeeze_threshold ?? current.f4_squeeze_threshold ?? 20,
      min_power_loss: updates.min_power_loss ?? current.min_power_loss ?? 90,
      trade_freshness_bars: updates.trade_freshness_bars ?? current.trade_freshness_bars ?? 5,
      scalp_length: updates.scalp_length ?? current.scalp_length ?? 11,
      scalp_volume_multiplier: updates.scalp_volume_multiplier ?? current.scalp_volume_multiplier ?? 3.0,
      swing_length: updates.swing_length ?? current.swing_length ?? 10,
      swing_volume_multiplier: updates.swing_volume_multiplier ?? current.swing_volume_multiplier ?? 1.2,
      pilot_mode: p_mode,
      pilot_use_usdt: p_usdt,
      scalp_f4_multiplier: updates.scalp_f4_multiplier ?? current.scalp_f4_multiplier ?? 3.7,
      swing_f4_multiplier: updates.swing_f4_multiplier ?? current.swing_f4_multiplier ?? 1.2,
      f4_alpha: updates.f4_alpha ?? current.f4_alpha ?? 95,
      fibo_length: updates.fibo_length ?? current.fibo_length ?? 20,
      long_squeeze_threshold: updates.long_squeeze_threshold !== undefined ? updates.long_squeeze_threshold : (current.long_squeeze_threshold ?? 20),
      short_squeeze_threshold: updates.short_squeeze_threshold !== undefined ? updates.short_squeeze_threshold : (current.short_squeeze_threshold ?? 20),
      f4_slope_threshold: updates.f4_slope_threshold !== undefined ? updates.f4_slope_threshold : (current.f4_slope_threshold ?? 0.01),
      // ── KRITIK EKSİKLER: AutoResearch'ten gelen optimize değerlerin DB'ye yazılabilmesi için ──
      // pilot_tp_percent / pilot_sl_percent: timeframe_settings içinde değil, root BotConfig sütunu olarak da saklanmalı
      pilot_tp_percent: updates.pilot_tp_percent !== undefined ? updates.pilot_tp_percent : ((current as any).pilot_tp_percent ?? 3.0),
      pilot_sl_percent: updates.pilot_sl_percent !== undefined ? updates.pilot_sl_percent : ((current as any).pilot_sl_percent ?? 1.5),
      // V2.1 indicator overrides (AutoResearch optimize eder)
      rsi_period: updates.rsi_period !== undefined ? updates.rsi_period : ((current as any).rsi_period ?? 14),
      rsi_ob: updates.rsi_ob !== undefined ? updates.rsi_ob : ((current as any).rsi_ob ?? 70),
      rsi_os: updates.rsi_os !== undefined ? updates.rsi_os : ((current as any).rsi_os ?? 30),
      adx_threshold: updates.adx_threshold !== undefined ? updates.adx_threshold : ((current as any).adx_threshold ?? 25),
      macd_fast: updates.macd_fast !== undefined ? updates.macd_fast : ((current as any).macd_fast ?? 12),
      macd_slow: updates.macd_slow !== undefined ? updates.macd_slow : ((current as any).macd_slow ?? 26),
      macd_signal: updates.macd_signal !== undefined ? updates.macd_signal : ((current as any).macd_signal ?? 9),
      stoch_rsi_len: updates.stoch_rsi_len !== undefined ? updates.stoch_rsi_len : ((current as any).stoch_rsi_len ?? 14),
      updated_at: now
    };

    console.log(`[DB] Saving bot config for User ${userId}...`);

    // Use a single query with column names extracted to avoid mismatches
    const columns = Object.keys(configData);
    const updatesStr = columns
      .filter(c => c !== 'user_id' && c !== 'id')
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(", ");

    const query = `
      INSERT INTO bot_configs (${columns.join(", ")})
      VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
      ON CONFLICT (user_id) DO UPDATE SET ${updatesStr}
    `;

    await sql.raw(query, Object.values(configData));
    
    console.log(`[DB] Bot config updated successfully for user ${userId}`);
  } catch (err: unknown) {
    console.error("[DB] updateBotConfig CRITICAL ERROR:", err);
    throw err;
  }
}

// --- LOCKING MECHANISM ---
export async function acquireLock(
  lockId: string,
  owner: string,
  timeoutMs: number = 30000,
): Promise<boolean> {
  const now = Date.now();
  const expires = now + timeoutMs;

  try {
    // Atomic attempt to acquire lock using UPSERT with condition
    // Only update if current lock is expired
    const result = await sql`
            INSERT INTO system_locks (id, owner, expires_at)
            VALUES (${lockId}, ${owner}, ${expires})
            ON CONFLICT (id) 
            DO UPDATE SET 
                owner = ${owner}, 
                expires_at = ${expires}
            WHERE system_locks.expires_at < ${now}
            RETURNING id
        `;
    
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    // Other errors (e.g. connection)
    return false;
  }
}

export async function releaseLock(lockId: string, owner: string): Promise<void> {
  await sql`DELETE FROM system_locks WHERE id = ${lockId} AND owner = ${owner}`;
}

export async function initializeUserSettings(userId: number): Promise<void> {
  const now = Date.now();
  try {
    // 1. Seed base bot config (Let defaults handle most columns)
    await sql`
      INSERT INTO bot_configs (
        user_id, updated_at
      ) VALUES (
        ${userId}, ${now}
      ) ON CONFLICT (user_id) DO NOTHING
    `;

    // 2. Set default trading mode to test
    await sql`
      INSERT INTO system_settings (user_id, key, value, updated_at)
      VALUES (${userId}, 'TRADING_MODE', 'test', ${now})
      ON CONFLICT (user_id, key) DO NOTHING
    `;

    console.log(`[DB] Successfully initialized settings for User ${userId}`);
  } catch (error) {
    console.error(`[DB] Error initializing settings for User ${userId}:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────
// AUTO-RESEARCH EXPERIMENTS
// ─────────────────────────────────────────────────────────────────

export interface AutoResearchExperiment {
  id: number;
  run_id: string;
  params: Record<string, unknown>;
  composite_score: number;
  win_rate: number;
  sharpe: number;
  profit_factor: number;
  max_drawdown: number;
  total_trades: number;
  total_pnl_pct: number;
  timeframe: string;
  symbol: string;
  search_phase: string;
  is_best: boolean;
  created_at: number;
}

/**
 * AutoResearch deneyini veritabanına kaydeder.
 * Kayıt öncesi parametreleri (precision ve type) sanitize eder.
 */
export async function insertAutoResearchExperiment(exp: Omit<AutoResearchExperiment, "id">): Promise<number> {
  try {
    // ─── Kesinlik ve Tip Sanitizasyonu ───
    const rawParams = exp.params as any;
    const cleanParams: Record<string, any> = {};
    
    // Bilinen sayısal alanlar ve hassasiyetleri
    const float2 = ["f4_multiplier", "whale_multiplier", "pilot_tp_percent", "pilot_sl_percent", "cover_tp_percent", "cover_sl_percent"];
    const float4 = ["pilot_tp_deviation", "pilot_sl_deviation", "cover_tp_deviation", "cover_sl_deviation"];
    const float6 = ["f4_slope_threshold"];
    const bools  = ["pilot_tp_trailing", "pilot_sl_trailing", "cover_tp_trailing", "cover_sl_trailing", "pilot_trailing_buy", "pilot_mtf_veto"];

    for (const [key, val] of Object.entries(rawParams)) {
      if (typeof val === "number") {
        if (float2.includes(key)) cleanParams[key] = parseFloat(val.toFixed(2));
        else if (float4.includes(key)) cleanParams[key] = parseFloat(val.toFixed(4));
        else if (float6.includes(key)) cleanParams[key] = parseFloat(val.toFixed(6));
        else cleanParams[key] = Math.round(val); // default integer
      } else if (bools.includes(key)) {
        cleanParams[key] = !!val;
      } else {
        cleanParams[key] = val; // diğeri (string vb)
      }
    }

    const result = await sql`
      INSERT INTO autoresearch_experiments
        (run_id, params, composite_score, win_rate, sharpe, profit_factor, max_drawdown,
         total_trades, total_pnl_pct, timeframe, symbol, search_phase, is_best, created_at)
      VALUES
        (${exp.run_id}, ${JSON.stringify(cleanParams)}, ${exp.composite_score},
         ${exp.win_rate}, ${exp.sharpe}, ${exp.profit_factor}, ${exp.max_drawdown},
         ${exp.total_trades}, ${exp.total_pnl_pct}, ${exp.timeframe}, ${exp.symbol},
         ${exp.search_phase}, ${exp.is_best}, ${exp.created_at})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  } catch (e: unknown) {
    console.error("[AutoResearch] DB Insert Error:", e instanceof Error ? e.message : String(e));
    throw e;
  }
}

/**
 * Mevcut en iyi deneyi ilgili timeframe için "is_best=false" olarak işaretle, ardından yeniyi "true" yap.
 */
export async function markNewBestExperiment(newId: number, timeframe: string): Promise<void> {
  await sql`UPDATE autoresearch_experiments SET is_best = false WHERE is_best = true AND timeframe = ${timeframe}`;
  await sql`UPDATE autoresearch_experiments SET is_best = true  WHERE id = ${newId}`;
}

/**
 * Belirli bir timeframe için en iyi deneyi döndür.
 */
export async function getBestExperiment(timeframe?: string): Promise<AutoResearchExperiment | null> {
  const query = timeframe 
    ? sql`SELECT * FROM autoresearch_experiments WHERE is_best = true AND timeframe = ${timeframe} ORDER BY composite_score DESC LIMIT 1`
    : sql`SELECT * FROM autoresearch_experiments WHERE is_best = true ORDER BY composite_score DESC LIMIT 1`;
    
  const { rows } = await query;
  if (!rows[0]) return null;
  return { ...rows[0], params: typeof rows[0].params === "string" ? JSON.parse(rows[0].params) : rows[0].params } as AutoResearchExperiment;
}

/**
 * Her timeframe için en iyi deneyi liste olarak döndür.
 */
export async function getBestExperimentsPerTimeframe(): Promise<AutoResearchExperiment[]> {
  const { rows } = await sql`
    SELECT DISTINCT ON (timeframe) *
    FROM autoresearch_experiments
    WHERE is_best = true
    ORDER BY timeframe, composite_score DESC
  `;
  return rows.map(r => ({
    ...r,
    params: typeof r.params === "string" ? JSON.parse(r.params) : r.params,
    composite_score: parseFloat(String(r.composite_score)),
    win_rate:         parseFloat(String(r.win_rate)),
    created_at:       Number(r.created_at)
  })) as AutoResearchExperiment[];
}

/**
 * Son N deneyi listele (dashboard için).
 */
export async function listAutoResearchExperiments(limit = 100): Promise<AutoResearchExperiment[]> {
  const { rows } = await sql`
    SELECT * FROM autoresearch_experiments
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({
    ...r,
    params: typeof r.params === "string" ? JSON.parse(r.params) : r.params,
    composite_score: parseFloat(String(r.composite_score)),
    win_rate:         parseFloat(String(r.win_rate)),
    sharpe:           parseFloat(String(r.sharpe)),
    profit_factor:    parseFloat(String(r.profit_factor)),
    max_drawdown:     parseFloat(String(r.max_drawdown)),
    total_pnl_pct:    parseFloat(String(r.total_pnl_pct)),
    total_trades:     parseInt(String(r.total_trades)),
    created_at:       Number(r.created_at),
  })) as AutoResearchExperiment[];
}

/**
 * AutoResearch tablosunu oluştur (bir kez çalıştırılır).
 */
export async function initAutoResearchTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS autoresearch_experiments (
      id             SERIAL PRIMARY KEY,
      run_id         UUID            NOT NULL,
      params         JSONB           NOT NULL,
      composite_score DOUBLE PRECISION DEFAULT 0,
      win_rate        DOUBLE PRECISION DEFAULT 0,
      sharpe          DOUBLE PRECISION DEFAULT 0,
      profit_factor   DOUBLE PRECISION DEFAULT 0,
      max_drawdown    DOUBLE PRECISION DEFAULT 0,
      total_trades    INTEGER          DEFAULT 0,
      total_pnl_pct   DOUBLE PRECISION DEFAULT 0,
      timeframe       VARCHAR(50)      DEFAULT '4h',
      symbol          VARCHAR(255)     DEFAULT 'BTCUSDT',
      search_phase    VARCHAR(50)      DEFAULT 'random',
      is_best         BOOLEAN          DEFAULT false,
      created_at      BIGINT           NOT NULL
    )
  `;
  // Index for fast lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_autores_score ON autoresearch_experiments (composite_score DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_autores_run   ON autoresearch_experiments (run_id)`;
  console.log("[AutoResearch] DB tablosu hazır.");
}

/**
 * Sistemi genelinde Dashboard konsoluna log basmak için kullanılır.
 */
export async function logSystemMessage(message: string, details?: string, sentiment: 'POSITIVE'|'NEGATIVE'|'NEUTRAL' = 'NEUTRAL', userId: number = DEFAULT_UID): Promise<void> {
  try {
    await sql`
      INSERT INTO system_logs (user_id, level, message, details, timestamp)
      VALUES (${userId}, 'SYSTEM', ${message}, ${details || null}, ${Date.now()})
    `;
  } catch (e) {
    console.warn("[DB] logSystemMessage failed:", e);
  }
}

