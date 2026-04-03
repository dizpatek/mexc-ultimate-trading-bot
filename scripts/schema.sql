-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
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

-- Ensure user_id and trading_mode exist if table was already created
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test';

-- Trade history table
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

-- Ensure user_id and trading_mode exist if table was already created
ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE trade_history ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test';

-- Portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_value NUMERIC,
  total_assets INTEGER,
  snapshot_date BIGINT,
  balances TEXT
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date TEXT,
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

-- Strategies table
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

-- Strategy signals table
CREATE TABLE IF NOT EXISTS strategy_signals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  strategy_id INTEGER REFERENCES strategies(id),
  symbol TEXT,
  signal_type TEXT NOT NULL,
  price NUMERIC,
  volume NUMERIC,
  timestamp BIGINT NOT NULL,
  executed BOOLEAN DEFAULT FALSE,
  execution_result TEXT,
  trading_mode TEXT,
  timeframe TEXT,
  veto_reason TEXT
);

-- System settings table (for API keys and configuration, per user)
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE(user_id, key)
);

-- Bot config table
CREATE TABLE IF NOT EXISTS bot_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  f4_length INTEGER DEFAULT 10,
  whale_multiplier NUMERIC DEFAULT 1.8,
  ai_threshold INTEGER DEFAULT 65,
  auto_trade BOOLEAN DEFAULT FALSE,
  defense_mode BOOLEAN DEFAULT FALSE,
  pilot_trailing_buy BOOLEAN DEFAULT TRUE,
  pilot_trailing_buy_dev NUMERIC DEFAULT 0.3,
  pilot_tp_trailing BOOLEAN DEFAULT TRUE,
  pilot_tp_deviation NUMERIC DEFAULT 0.5,
  pilot_sl_trailing BOOLEAN DEFAULT TRUE,
  pilot_sl_deviation NUMERIC DEFAULT 0.5,
  updated_at BIGINT NOT NULL,
  timeframe_settings JSONB DEFAULT '{}'
);

-- Migrations for existing systems
ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS trading_mode TEXT;
ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS timeframe TEXT;
ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS veto_reason TEXT;

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE bot_configs DROP CONSTRAINT IF EXISTS bot_configs_user_id_key;
ALTER TABLE bot_configs ADD CONSTRAINT bot_configs_user_id_key UNIQUE(user_id);

ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE performance_metrics ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS performance_metrics_date_key;
ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS performance_metrics_user_date_key;
ALTER TABLE performance_metrics ADD CONSTRAINT performance_metrics_user_date_key UNIQUE(user_id, date);

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_key;
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS user_setting_unique;
ALTER TABLE system_settings ADD CONSTRAINT user_setting_unique UNIQUE(user_id, key);
