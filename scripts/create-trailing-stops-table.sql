CREATE TABLE IF NOT EXISTS trailing_stops (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity DECIMAL NOT NULL,
    entry_price DECIMAL NOT NULL,
    highest_price DECIMAL NOT NULL,
    callback_rate DECIMAL NOT NULL, -- e.g., 2.0 for 2%
    activation_price DECIMAL, -- Optional: price to start trailing
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, TRIGGERED, EXECUTED, CANCELLED
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trailing_stops_status ON trailing_stops(status);
CREATE INDEX IF NOT EXISTS idx_trailing_stops_user ON trailing_stops(user_id);
