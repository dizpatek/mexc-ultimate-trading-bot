import { sql } from "@/lib/postgres";

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

export async function ensureTablesExist(): Promise<boolean> {
  if (isInitialized) return true;

  // Use a single promise to handle concurrent calls (P4.3 race condition fix)
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log("[DB-Init] Checking and creating all necessary tables...");

        await createCoreTables();
        await createTradeTables();
        await createPortfolioTables();
        await createBotTables();
        await createMarketDataTables();
        await createNewsTable();
        await createNotificationsTable();
        await runSchemaMigrations();
        await createDefaultConfigs();
        await createIndexes();
        await cleanupOldData();

        console.log("[DB-Init] All tables verified successfully.");
        isInitialized = true;
        return true;
      } catch (error) {
        console.error("[DB-Init] Error initializing database tables:", error);
        initPromise = null; // Clear promise on error to allow real retry on next call (P4.1 fix)
        throw error;
      }
    })();
  }

  try {
    return await initPromise;
  } catch (err) {
    // If it failed, help subsequent concurrent calls by ensuring the promise is null
    initPromise = null;
    throw err;
  }
}

async function createNotificationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'INFO',
      is_read BOOLEAN DEFAULT FALSE,
      type TEXT DEFAULT 'BOTH',
      created_at BIGINT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_reads (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      read_at BIGINT NOT NULL,
      UNIQUE(notification_id, user_id)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);`;
}

async function createCoreTables() {
  // 1. Users Table (Must be created FIRST for foreign key references)
  await sql`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );
    `;

  // Insert default admin if no users exist
  try {
    const { rowCount } = await sql`SELECT 1 FROM users LIMIT 1`;
    if (rowCount === 0) {
      const now = Date.now();
      // Default: admin / admin123
      await sql`
        INSERT INTO users (username, email, password_hash, is_admin, created_at, updated_at)
        VALUES ('admin', 'admin@matrix.com', '$2b$10$TSZeLkzgREvbGJKjAktGVe8j8Pe/yl/745zcYQ243qG0RUW9vwhaC', TRUE, ${now}, ${now})
      `;
      console.log("[DB-Init] Default admin user created.");
    }
  } catch (e) {
    console.warn("[DB-Init] Admin user check/creation warning:", e);
  }

  // System logs table for generic status updates
  await sql`
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            timestamp BIGINT NOT NULL
        );
    `;
}

async function createTradeTables() {
  // 2. Orders Table (Now with user_id)
  await sql`
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            mexc_order_id TEXT,
            symbol TEXT,
            side TEXT,
            type TEXT,
            qty NUMERIC,
            quote NUMERIC,
            price NUMERIC,
            status TEXT,
            trading_mode TEXT DEFAULT 'test',
            created_at BIGINT,
            updated_at BIGINT,
            meta TEXT
        );
    `;
    // Ensure column exists for migration
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test';`.catch(() => {});

  // 3. Trade History Table (Standardized name, now with user_id)
  await sql`
        CREATE TABLE IF NOT EXISTS trade_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            order_id INTEGER REFERENCES orders(id),
            symbol TEXT NOT NULL,
            side TEXT NOT NULL,
            type TEXT,
            qty NUMERIC,
            price NUMERIC,
            quote_qty NUMERIC,
            commission NUMERIC,
            commission_asset TEXT,
            profit_loss NUMERIC,
            profit_loss_percentage NUMERIC,
            trading_mode TEXT DEFAULT 'test',
            created_at BIGINT
        );
    `;
    // Ensure column exists for migration
    await sql`ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test';`.catch(() => {});
}

async function createPortfolioTables() {
  // 4. Portfolio Table (For direct balance tracking)
  await sql`
        CREATE TABLE IF NOT EXISTS portfolio (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            symbol TEXT NOT NULL,
            balance NUMERIC NOT NULL DEFAULT 0,
            type TEXT DEFAULT 'SIMULATOR',
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            UNIQUE(user_id, symbol, type)
        );
    `;

  // 5. Portfolio Snapshots (Now with user_id)
  await sql`
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            total_value NUMERIC,
            total_assets INTEGER,
            snapshot_date BIGINT,
            balances TEXT
        );
    `;

  // 6. Performance Metrics (Per user per date)
  await sql`
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            date TEXT NOT NULL,
            total_trades INTEGER DEFAULT 0,
            winning_trades INTEGER DEFAULT 0,
            losing_trades INTEGER DEFAULT 0,
            total_profit_loss NUMERIC DEFAULT 0,
            win_rate NUMERIC DEFAULT 0,
            avg_profit NUMERIC DEFAULT 0,
            avg_loss NUMERIC DEFAULT 0,
            best_trade NUMERIC DEFAULT 0,
            worst_trade NUMERIC DEFAULT 0,
            UNIQUE(user_id, date)
        );
    `;
}

async function createBotTables() {
  // 7. DCA Bots
  await sql`
        CREATE TABLE IF NOT EXISTS dca_bots (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            symbol TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            interval_hours INTEGER NOT NULL,
            take_profit_percent NUMERIC,
            total_invested NUMERIC DEFAULT 0,
            total_bought_qty NUMERIC DEFAULT 0,
            average_price NUMERIC DEFAULT 0,
            status TEXT DEFAULT 'ACTIVE',
            last_run_at BIGINT DEFAULT 0,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            meta TEXT
        );
    `;

  // 8. Strategies
  await sql`
        CREATE TABLE IF NOT EXISTS strategies (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            symbol TEXT NOT NULL,
            strategy_type TEXT NOT NULL,
            parameters TEXT NOT NULL,
            active BOOLEAN DEFAULT TRUE,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );
    `;

  // 9. Strategy Signals
  await sql`
        CREATE TABLE IF NOT EXISTS strategy_signals (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            strategy_id INTEGER REFERENCES strategies(id),
            symbol TEXT,
            side TEXT,
            signal_type TEXT NOT NULL,
            price NUMERIC,
            volume NUMERIC,
            timestamp BIGINT NOT NULL,
            executed BOOLEAN DEFAULT FALSE,
            execution_result TEXT,
            trading_mode TEXT,
            timeframe TEXT,
            veto_reason TEXT,
            payload JSONB
        );
    `;

  // Ensure columns exist (for existing tables)
  await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS side TEXT;`.catch(() => {});
  await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS payload JSONB;`.catch(() => {});

  // 10. Alarms
  await sql`
        CREATE TABLE IF NOT EXISTS alarms (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id), 
            symbol VARCHAR(20) NOT NULL,
            indicator_type VARCHAR(50) DEFAULT 'F3',
            condition_type VARCHAR(20) NOT NULL,
            action_type VARCHAR(20) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at BIGINT NOT NULL,
            last_triggered_at BIGINT
        );
    `;

  // 11. Alarm Logs
  await sql`
        CREATE TABLE IF NOT EXISTS alarm_logs (
            id SERIAL PRIMARY KEY,
            alarm_id INTEGER REFERENCES alarms(id),
            triggered_at BIGINT NOT NULL,
            signal_value DECIMAL(20, 8),
            action_result JSONB,
            success BOOLEAN
        );
    `;

  // 12. Panic Snapshots
  await sql`
        CREATE TABLE IF NOT EXISTS panic_snapshots (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            snapshot_data JSONB NOT NULL,
            total_usdt_value DECIMAL(20, 8) NOT NULL,
            created_at BIGINT NOT NULL
        );
    `;

  // 13. System Settings (Per User)
  await sql`
        CREATE TABLE IF NOT EXISTS system_settings (
            user_id INTEGER REFERENCES users(id),
            key VARCHAR(50) NOT NULL,
            value TEXT NOT NULL,
            updated_at BIGINT NOT NULL,
            PRIMARY KEY (user_id, key)
        );
    `;

  // 14. System Locks (For cross-process safety)
  await sql`
        CREATE TABLE IF NOT EXISTS system_locks (
            id VARCHAR(50) PRIMARY KEY,
            owner TEXT,
            expires_at BIGINT NOT NULL
        );
    `;

  // 15. Bot Config (Global/Per User) - Moved here to ensure it exists before migrations
  await sql`
        CREATE TABLE IF NOT EXISTS bot_configs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE REFERENCES users(id),
            f4_length INTEGER DEFAULT 11,
            whale_multiplier NUMERIC DEFAULT 1.2,
            ai_threshold INTEGER DEFAULT 65,
            auto_trade BOOLEAN DEFAULT FALSE,
            defense_mode BOOLEAN DEFAULT FALSE,
            pilot_mode TEXT DEFAULT 'matrix',
            pilot_use_usdt BOOLEAN DEFAULT FALSE,
            pilot_timeframe TEXT DEFAULT '4h',
            pilot_trailing_buy BOOLEAN DEFAULT TRUE,
            pilot_trailing_buy_dev NUMERIC DEFAULT 0.3,
            pilot_tp_trailing BOOLEAN DEFAULT TRUE,
            pilot_tp_deviation NUMERIC DEFAULT 0.5,
            pilot_sl_trailing BOOLEAN DEFAULT TRUE,
            pilot_sl_deviation NUMERIC DEFAULT 0.5,
            pilot_mtf_veto BOOLEAN DEFAULT TRUE,
            pilot_mtf_threshold INTEGER DEFAULT 70,
            pilot_mtf_long_threshold INTEGER DEFAULT 70,
            pilot_mtf_short_threshold INTEGER DEFAULT 30,
            pilot_only_holdings BOOLEAN DEFAULT TRUE,
            trade_freshness_bars INTEGER DEFAULT 5,
            fibo_length INTEGER DEFAULT 20,
            f4_alpha NUMERIC DEFAULT 95,
            f4_multiplier NUMERIC DEFAULT 1.0,
            scalp_f4_multiplier NUMERIC DEFAULT 3.7,
            swing_f4_multiplier NUMERIC DEFAULT 1.2,
            f4_power_loss_threshold NUMERIC DEFAULT 90,
            f4_slope_threshold NUMERIC DEFAULT 0.01,
            long_squeeze_threshold NUMERIC DEFAULT 20,
            short_squeeze_threshold NUMERIC DEFAULT 20,
            f4_lookback_bars INTEGER DEFAULT 30,
            f4_squeeze_threshold NUMERIC DEFAULT 20,
            min_power_loss NUMERIC DEFAULT 90,
            scalp_length INTEGER DEFAULT 11,
            scalp_volume_multiplier NUMERIC DEFAULT 3.0,
            swing_length INTEGER DEFAULT 10,
            swing_volume_multiplier NUMERIC DEFAULT 1.2,
            timeframe_settings JSONB DEFAULT '{}',
            updated_at BIGINT NOT NULL
        );
    `;
}

async function runSchemaMigrations() {
  // User migrations
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`;
    // Ensure the FIRST user is always an admin as a fallback safety
    await sql`UPDATE users SET is_admin = TRUE WHERE id = 1`;
  } catch {
    /* ignore */
  }

  // Strategy signals migrations
  try {
    await sql`ALTER TABLE strategy_signals ALTER COLUMN strategy_id DROP NOT NULL;`;
    await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS symbol TEXT;`;
    await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS side TEXT;`;
    await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS payload JSONB;`;
    await sql`ALTER TABLE strategy_signals ALTER COLUMN price DROP NOT NULL;`;
  } catch (err) {
    console.warn("[DB-Init] strategy_signals migration warning:", err);
  }

  // DCA bot migrations
  try {
    await sql`ALTER TABLE dca_bots ADD COLUMN IF NOT EXISTS meta TEXT`;
  } catch {
    /* ignore */
  }

  // Bot Config migrations
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS auto_trade BOOLEAN DEFAULT FALSE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS defense_mode BOOLEAN DEFAULT FALSE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_timeframe TEXT DEFAULT '4h'`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs DROP COLUMN IF EXISTS timeframe`;
    await sql`ALTER TABLE bot_configs DROP COLUMN IF EXISTS timeframe_locked`;
  } catch {
    /* ignore */
  }

  // Pilot Configuration migrations
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_trailing_buy BOOLEAN DEFAULT TRUE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_trailing_buy_dev NUMERIC DEFAULT 0.3`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_tp_trailing BOOLEAN DEFAULT TRUE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_tp_deviation NUMERIC DEFAULT 0.5`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_multiplier NUMERIC DEFAULT 1.0`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS scalp_f4_multiplier NUMERIC DEFAULT 3.7`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS swing_f4_multiplier NUMERIC DEFAULT 1.2`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_sl_trailing BOOLEAN DEFAULT TRUE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_sl_deviation NUMERIC DEFAULT 0.5`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_threshold INTEGER DEFAULT 70`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_long_threshold INTEGER DEFAULT 70`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_short_threshold INTEGER DEFAULT 30`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS trade_freshness_bars INTEGER DEFAULT 5`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_lookback_bars INTEGER DEFAULT 30`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_squeeze_threshold NUMERIC DEFAULT 20`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS min_power_loss NUMERIC DEFAULT 90`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS scalp_length INTEGER DEFAULT 11`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS scalp_volume_multiplier NUMERIC DEFAULT 3.0`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS swing_length INTEGER DEFAULT 10`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS swing_volume_multiplier NUMERIC DEFAULT 1.2`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_veto BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_only_holdings BOOLEAN DEFAULT TRUE`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS fibo_length INTEGER DEFAULT 20`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_alpha NUMERIC DEFAULT 95`;
  } catch {
    /* ignore */
  }

  // ADD timeframe_settings migration
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS timeframe_settings JSONB DEFAULT '{}'`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_power_loss_threshold NUMERIC DEFAULT 90`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mode TEXT DEFAULT 'matrix'`;
  } catch {
    /* ignore */
  }
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_use_usdt BOOLEAN DEFAULT FALSE`;
  } catch {
    /* ignore */
  }

  // Gelişmiş Motor Ayarları (Squeeze & Slope)
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS long_squeeze_threshold NUMERIC DEFAULT 20`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS short_squeeze_threshold NUMERIC DEFAULT 20`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS f4_slope_threshold NUMERIC DEFAULT 0.01`;
  } catch {
    /* ignore */
  }

  // Ensure bot_configs id is serial (fix 500 errors on PK)
  try {
    await sql`
      CREATE SEQUENCE IF NOT EXISTS bot_configs_id_seq;
      ALTER TABLE bot_configs ALTER COLUMN id SET DEFAULT nextval('bot_configs_id_seq');
      SELECT setval('bot_configs_id_seq', COALESCE((SELECT MAX(id) FROM bot_configs), 0) + 1, false);
    `;
  } catch (e) {}

  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    await sql`ALTER TABLE bot_configs ADD CONSTRAINT IF NOT EXISTS bot_configs_user_id_key UNIQUE(user_id)`;
  } catch (e) {}

  // Portfolio snapshots & Performance metrics migrations
  try {
    await sql`ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
    await sql`ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
  } catch {
    /* ignore */
  }
}

async function createDefaultConfigs() {
  try {
    const { rowCount } = await sql`SELECT 1 FROM bot_configs WHERE id = 1`;
    if (rowCount === 0) {
      await sql`
        INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, updated_at, 
                                 pilot_trailing_buy, pilot_trailing_buy_dev, pilot_tp_trailing, pilot_tp_deviation, pilot_sl_trailing, pilot_sl_deviation, pilot_timeframe, fibo_length, timeframe_settings,
                                 f4_power_loss_threshold, long_squeeze_threshold, short_squeeze_threshold, f4_slope_threshold)
        VALUES (1, 11, 3.0, 65, false, false, ${Date.now()}, 
                true, 0.3, true, 0.3, true, 1.0, '4h', 20, '{"pilot_tp_percent": 2.0, "pilot_sl_percent": 1.0, "cover_tp_percent": 1.0, "cover_sl_percent": 1.0, "cover_tp_trailing": true, "cover_tp_deviation": 0.3, "cover_sl_trailing": true, "cover_sl_deviation": 1.0}',
                90, 20, 20, 0.01)
            `;
      console.log("[DB-Init] Default bot config inserted.");
    }
  } catch (e) {
    console.error("[DB-Init] default config check/insert error:", e);
  }
}

async function createIndexes() {
  // 15. Performance Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_strategy_signals_timestamp ON strategy_signals(timestamp);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_strategy_signals_symbol ON strategy_signals(symbol);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON strategies(user_id);`;
  
  // P4.7: Dashboard Performance Optimization Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_mode_status ON orders(user_id, trading_mode, status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_mode_created ON orders(user_id, trading_mode, created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trade_history_order_id ON trade_history(order_id);`;
}

async function createMarketDataTables() {
  // 16. Market Trades Table (For Caching sjoerd.tech data)
  await sql`
        CREATE TABLE IF NOT EXISTS market_trades (
            id SERIAL PRIMARY KEY,
            symbol TEXT NOT NULL,
            exchange TEXT NOT NULL,
            t BIGINT NOT NULL,
            p NUMERIC NOT NULL,
            q NUMERIC NOT NULL,
            side INTEGER NOT NULL,
            usd NUMERIC NOT NULL,
            created_at BIGINT,
            UNIQUE(symbol, exchange, t, p, q, side)
        );
    `;
  await sql`CREATE INDEX IF NOT EXISTS idx_market_trades_t ON market_trades(t);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_market_trades_lookup ON market_trades(symbol, exchange, t);`;
}

async function createNewsTable() {
  // 17. News Table (For Persistent Intelligence Hub)
  await sql`
        CREATE TABLE IF NOT EXISTS news (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            translated_title TEXT,
            excerpt TEXT,
            source TEXT NOT NULL,
            time TEXT,
            url TEXT UNIQUE NOT NULL,
            image_url TEXT,
            published_on BIGINT NOT NULL,
            created_at BIGINT NOT NULL
        );
    `;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_published_on ON news(published_on DESC);`;
}

async function cleanupOldData() {
  try {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SEVEN_DAYS_MS;

    console.log(`[DB-Cleanup] Starting scheduled cleanup (older than 7 days)...`);

    // 1. Clean market_trades (High volume)
    const marketRes = await sql`DELETE FROM market_trades WHERE t < ${cutoff}`;
    if (marketRes.rowCount && marketRes.rowCount > 0) {
      console.log(`[DB-Cleanup] Deleted ${marketRes.rowCount} old market trades.`);
    }

    // 2. Clean system_logs (High volume)
    const logRes = await sql`DELETE FROM system_logs WHERE timestamp < ${cutoff}`;
    if (logRes.rowCount && logRes.rowCount > 0) {
      console.log(`[DB-Cleanup] Deleted ${logRes.rowCount} old system logs.`);
    }

    // 3. Clean processed strategy signals (Keep some history but not infinite)
    const signalRes = await sql`DELETE FROM strategy_signals WHERE timestamp < ${cutoff} AND executed = true`;
    if (signalRes.rowCount && signalRes.rowCount > 0) {
      console.log(`[DB-Cleanup] Deleted ${signalRes.rowCount} old executed signals.`);
    }

    console.log(`[DB-Cleanup] Cleanup completed successfully.`);
  } catch (error) {
    console.error(`[DB-Cleanup] Error during automatic cleanup:`, error);
  }
}
