CREATE TABLE IF NOT EXISTS dca_bots (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    amount DECIMAL NOT NULL,      -- Amount in USDT to buy each time
    interval_hours INTEGER NOT NULL, -- How often to buy (e.g. 24 for daily)
    take_profit_percent DECIMAL,  -- Optional: Sell all when profit reaches X%
    total_invested DECIMAL DEFAULT 0, -- Total USDT spent
    total_bought_qty DECIMAL DEFAULT 0, -- Total Token quantity bought
    average_price DECIMAL DEFAULT 0, -- Avg entry price
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, CANCELLED
    last_run_at BIGINT DEFAULT 0, -- Timestamp of last execution
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dca_bots_user ON dca_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_dca_bots_status ON dca_bots(status);
