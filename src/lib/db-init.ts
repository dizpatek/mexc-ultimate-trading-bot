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
        await runSchemaMigrations();
        await createDefaultConfigs();
        await createIndexes();

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

  // System logs table for generic status updates
  await sql`
        CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
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
            created_at BIGINT,
            updated_at BIGINT,
            meta TEXT
        );
    `;

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
            created_at BIGINT
        );
    `;
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
            strategy_id INTEGER NOT NULL REFERENCES strategies(id),
            signal_type TEXT NOT NULL,
            price NUMERIC NOT NULL,
            volume NUMERIC,
            timestamp BIGINT NOT NULL,
            executed BOOLEAN DEFAULT FALSE,
            execution_result TEXT
        );
    `;

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
  await sql`ALTER TABLE strategy_signals ALTER COLUMN strategy_id DROP NOT NULL;`.catch(
    () => {},
  );
  await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS symbol TEXT;`.catch(
    () => {},
  );
  await sql`ALTER TABLE strategy_signals ALTER COLUMN price DROP NOT NULL;`.catch(
    () => {},
  );

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
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS fibo_length INTEGER DEFAULT 20`;
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
}

async function createDefaultConfigs() {
  // 14. Bot Config (Global)
  try {
    await sql`
            CREATE TABLE IF NOT EXISTS bot_configs (
                id INTEGER PRIMARY KEY,
                f4_length INTEGER DEFAULT 10,
                whale_multiplier NUMERIC DEFAULT 1.8,
                ai_threshold INTEGER DEFAULT 65,
                auto_trade BOOLEAN DEFAULT FALSE,
                defense_mode BOOLEAN DEFAULT FALSE,
                updated_at BIGINT NOT NULL,
                timeframe_settings JSONB DEFAULT '{}'
            );
        `;
  } catch (e) {
    console.warn("[DB-Init] bot_configs table creation warning:", e);
  }

  try {
    const { rowCount } = await sql`SELECT 1 FROM bot_configs WHERE id = 1`;
    if (rowCount === 0) {
      await sql`
        INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, updated_at, 
                                 pilot_trailing_buy, pilot_trailing_buy_dev, pilot_tp_trailing, pilot_tp_deviation, pilot_sl_trailing, pilot_sl_deviation, pilot_timeframe, fibo_length, timeframe_settings)
        VALUES (1, 10, 1.8, 65, false, false, ${Date.now()}, 
                true, 0.3, true, 1.0, true, 0.5, '4h', 20, '{"pilot_tp_percent": 1.5, "pilot_sl_percent": 0.5, "cover_tp_percent": 1.5, "cover_sl_percent": 0.5, "cover_tp_trailing": true, "cover_tp_deviation": 0.3, "cover_sl_trailing": false, "cover_sl_deviation": 1.0}')
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
}
