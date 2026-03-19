-- Performance Index Migration: Add user_id indexes for multi-user scalability
-- This helps when filtering by user_id in large tables

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_user_id ON trade_history(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_signals_user_id ON strategy_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_user_id ON system_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);

-- Optional: Index on symbol for common queries
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_strategy_signals_timestamp ON strategy_signals(timestamp);
