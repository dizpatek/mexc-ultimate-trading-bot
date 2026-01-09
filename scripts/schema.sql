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

-- Trade history table
CREATE TABLE IF NOT EXISTS trade_history (
  id SERIAL PRIMARY KEY,
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

-- Portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  total_value NUMERIC,
  total_assets INTEGER,
  snapshot_date BIGINT,
  balances TEXT
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  avg_profit NUMERIC DEFAULT 0,
  avg_loss NUMERIC DEFAULT 0,
  best_trade NUMERIC DEFAULT 0,
  worst_trade NUMERIC DEFAULT 0
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
  strategy_id INTEGER NOT NULL REFERENCES strategies(id),
  signal_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  volume NUMERIC,
  timestamp BIGINT NOT NULL,
  executed BOOLEAN DEFAULT FALSE,
  execution_result TEXT
);
