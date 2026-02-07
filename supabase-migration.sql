-- Supabase Migration for Market Resolution System
-- Run this in your Supabase SQL Editor

-- 1. Create the leaderboard table (if not exists)
CREATE TABLE IF NOT EXISTS leaderboard (
  address TEXT PRIMARY KEY,
  pnl REAL DEFAULT 0,
  bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  volume REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create tracked_markets table
CREATE TABLE IF NOT EXISTS tracked_markets (
  id TEXT PRIMARY KEY,           -- Manifold market id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked TIMESTAMPTZ,
  settled BOOLEAN DEFAULT FALSE
);

-- 3. Create bets table
CREATE TABLE IF NOT EXISTS bets (
  id BIGSERIAL PRIMARY KEY,
  market_id TEXT NOT NULL,
  user_address TEXT NOT NULL,
  side BOOLEAN NOT NULL,         -- true = YES, false = NO
  amount NUMERIC NOT NULL,        -- stored as ETH (not wei)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (market_id) REFERENCES tracked_markets(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_pnl ON leaderboard(pnl DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_markets_settled ON tracked_markets(settled);
CREATE INDEX IF NOT EXISTS idx_bets_market_id ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_address ON bets(user_address);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leaderboard
CREATE POLICY "Allow public read access on leaderboard"
  ON leaderboard
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access on leaderboard"
  ON leaderboard
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tracked_markets
CREATE POLICY "Allow public read access on tracked_markets"
  ON tracked_markets
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access on tracked_markets"
  ON tracked_markets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for bets
CREATE POLICY "Allow public read access on bets"
  ON bets
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role write access on bets"
  ON bets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on leaderboard
CREATE TRIGGER update_leaderboard_updated_at
  BEFORE UPDATE ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Function to update leaderboard (can be called via RPC)
CREATE OR REPLACE FUNCTION update_leaderboard(
  _address TEXT,
  _pnl_change NUMERIC,
  _won BOOLEAN,
  _amount NUMERIC
)
RETURNS VOID AS $$
DECLARE
  existing_record RECORD;
BEGIN
  -- Get existing record
  SELECT * INTO existing_record FROM leaderboard WHERE address = _address;
  
  -- Upsert the record
  INSERT INTO leaderboard (address, pnl, bets, wins, losses, volume)
  VALUES (
    _address,
    COALESCE(existing_record.pnl, 0) + _pnl_change,
    COALESCE(existing_record.bets, 0) + 1,
    COALESCE(existing_record.wins, 0) + (CASE WHEN _won THEN 1 ELSE 0 END),
    COALESCE(existing_record.losses, 0) + (CASE WHEN _won THEN 0 ELSE 1 END),
    COALESCE(existing_record.volume, 0) + ABS(_amount)
  )
  ON CONFLICT (address) DO UPDATE SET
    pnl = leaderboard.pnl + _pnl_change,
    bets = leaderboard.bets + 1,
    wins = leaderboard.wins + (CASE WHEN _won THEN 1 ELSE 0 END),
    losses = leaderboard.losses + (CASE WHEN _won THEN 0 ELSE 1 END),
    volume = leaderboard.volume + ABS(_amount),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
