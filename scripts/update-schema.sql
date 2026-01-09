-- Auto Pilot and Cycle Management
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Trading Cycles (The 4-month process)
CREATE TABLE IF NOT EXISTS trading_cycles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, COMPLETED, CANCELLED
  current_phase_index INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL
);

-- Initialize settings if not exists
INSERT INTO system_settings (key, value, updated_at) 
VALUES ('autopilot_active', 'false', 1704837200000)
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, updated_at) 
VALUES ('current_cycle_id', 'null', 1704837200000)
ON CONFLICT (key) DO NOTHING;
