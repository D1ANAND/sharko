-- ============================================================================
-- COMPLETE SUPABASE MIGRATION FOR YELLOW NETWORK STATE CHANNELS
-- Run this ONCE in a fresh Supabase project
-- ============================================================================

-- ============================================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 2: CORE TABLES (Original Schema)
-- ============================================================================

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  address TEXT PRIMARY KEY,
  pnl NUMERIC DEFAULT 0,
  bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  volume NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracked markets table
CREATE TABLE IF NOT EXISTS tracked_markets (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  settled BOOLEAN DEFAULT FALSE
);

-- Bets table (original - for backward compatibility)
CREATE TABLE IF NOT EXISTS bets (
  id BIGSERIAL PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES tracked_markets(id),
  user_address TEXT NOT NULL,
  side BOOLEAN NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 3: STATE CHANNEL TABLES (Yellow Network)
-- ============================================================================

-- Sessions table (Yellow state channels)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  yellow_session_id TEXT,
  initial_deposit NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  total_bet_amount NUMERIC DEFAULT 0,
  total_won NUMERIC DEFAULT 0,
  total_lost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  settlement_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session bets table (off-chain bets)
CREATE TABLE IF NOT EXISTS session_bets (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL REFERENCES tracked_markets(id),
  user_address TEXT NOT NULL,
  side BOOLEAN NOT NULL,
  amount NUMERIC NOT NULL,
  state_hash TEXT,
  signature TEXT,
  settled BOOLEAN DEFAULT FALSE,
  won BOOLEAN,
  pnl NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link bets to sessions (optional)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);

-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Leaderboard indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_pnl ON leaderboard(pnl DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_bets ON leaderboard(bets DESC);

-- Tracked markets indexes
CREATE INDEX IF NOT EXISTS idx_tracked_markets_settled ON tracked_markets(settled);

-- Bets indexes
CREATE INDEX IF NOT EXISTS idx_bets_market_id ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_address ON bets(user_address);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_address ON sessions(user_address);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_opened_at ON sessions(opened_at DESC);

-- Session bets indexes
CREATE INDEX IF NOT EXISTS idx_session_bets_session_id ON session_bets(session_id);
CREATE INDEX IF NOT EXISTS idx_session_bets_market_id ON session_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_session_bets_user_address ON session_bets(user_address);
CREATE INDEX IF NOT EXISTS idx_session_bets_settled ON session_bets(settled);

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_bets ENABLE ROW LEVEL SECURITY;

-- Leaderboard policies
CREATE POLICY "Allow public read access on leaderboard"
  ON leaderboard FOR SELECT USING (true);

CREATE POLICY "Allow service role write access on leaderboard"
  ON leaderboard FOR ALL USING (true) WITH CHECK (true);

-- Tracked markets policies
CREATE POLICY "Allow public read access on tracked_markets"
  ON tracked_markets FOR SELECT USING (true);

CREATE POLICY "Allow service role write access on tracked_markets"
  ON tracked_markets FOR ALL USING (true) WITH CHECK (true);

-- Bets policies
CREATE POLICY "Allow public read access on bets"
  ON bets FOR SELECT USING (true);

CREATE POLICY "Allow service role write access on bets"
  ON bets FOR ALL USING (true) WITH CHECK (true);

-- Sessions policies
CREATE POLICY "Allow public read access on sessions"
  ON sessions FOR SELECT USING (true);

CREATE POLICY "Allow service role write access on sessions"
  ON sessions FOR ALL USING (true) WITH CHECK (true);

-- Session bets policies
CREATE POLICY "Allow public read access on session_bets"
  ON session_bets FOR SELECT USING (true);

CREATE POLICY "Allow service role write access on session_bets"
  ON session_bets FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 6: TRIGGERS
-- ============================================================================

-- Leaderboard updated_at trigger
CREATE TRIGGER update_leaderboard_updated_at
  BEFORE UPDATE ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sessions updated_at trigger
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 7: STATE CHANNEL FUNCTIONS
-- ============================================================================

-- Get active session for a user
CREATE OR REPLACE FUNCTION get_active_session(user_addr TEXT)
RETURNS TABLE (
  id UUID,
  user_address TEXT,
  yellow_session_id TEXT,
  initial_deposit NUMERIC,
  current_balance NUMERIC,
  total_bet_amount NUMERIC,
  status TEXT,
  opened_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_address, s.yellow_session_id, s.initial_deposit, 
         s.current_balance, s.total_bet_amount, s.status, s.opened_at
  FROM sessions s
  WHERE s.user_address = user_addr
    AND s.status = 'open'
  ORDER BY s.opened_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Place a bet within a session (atomic operation)
CREATE OR REPLACE FUNCTION place_session_bet(
  _session_id UUID,
  _market_id TEXT,
  _user_address TEXT,
  _side BOOLEAN,
  _amount NUMERIC,
  _state_hash TEXT DEFAULT NULL,
  _signature TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  session_record RECORD;
  bet_id BIGINT;
BEGIN
  -- Get and lock the session
  SELECT * INTO session_record
  FROM sessions
  WHERE id = _session_id AND status = 'open'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Session not found or not open');
  END IF;
  
  -- Check if user has enough balance
  IF session_record.current_balance < _amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance in session');
  END IF;
  
  -- Insert the bet
  INSERT INTO session_bets (session_id, market_id, user_address, side, amount, state_hash, signature)
  VALUES (_session_id, _market_id, _user_address, _side, _amount, _state_hash, _signature)
  RETURNING id INTO bet_id;
  
  -- Update session balance
  UPDATE sessions
  SET 
    current_balance = current_balance - _amount,
    total_bet_amount = total_bet_amount + _amount,
    updated_at = NOW()
  WHERE id = _session_id;
  
  RETURN json_build_object(
    'success', true, 
    'bet_id', bet_id,
    'new_balance', session_record.current_balance - _amount
  );
END;
$$ LANGUAGE plpgsql;

-- Settle session bets when market resolves
CREATE OR REPLACE FUNCTION settle_session_bets(
  _market_id TEXT,
  _resolved_yes BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  bet_record RECORD;
  total_settled INTEGER := 0;
BEGIN
  -- Update all unsettled bets for this market
  FOR bet_record IN 
    SELECT * FROM session_bets 
    WHERE market_id = _market_id AND settled = FALSE
  LOOP
    DECLARE
      bet_won BOOLEAN;
      bet_pnl NUMERIC;
    BEGIN
      bet_won := bet_record.side = _resolved_yes;
      bet_pnl := CASE WHEN bet_won THEN bet_record.amount ELSE -bet_record.amount END;
      
      -- Update the bet
      UPDATE session_bets
      SET 
        settled = TRUE,
        won = bet_won,
        pnl = bet_pnl
      WHERE id = bet_record.id;
      
      -- Update session balance (return original bet + winnings if won)
      UPDATE sessions
      SET 
        current_balance = current_balance + CASE WHEN bet_won THEN bet_record.amount * 2 ELSE 0 END,
        total_won = total_won + CASE WHEN bet_won THEN bet_record.amount ELSE 0 END,
        total_lost = total_lost + CASE WHEN NOT bet_won THEN bet_record.amount ELSE 0 END,
        updated_at = NOW()
      WHERE id = bet_record.session_id;
      
      total_settled := total_settled + 1;
    END;
  END LOOP;
  
  RETURN json_build_object('success', true, 'bets_settled', total_settled);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- ============================================================================

-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('leaderboard', 'tracked_markets', 'bets', 'sessions', 'session_bets');

-- Check all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_active_session', 'place_session_bet', 'settle_session_bets', 'update_updated_at_column');

-- ============================================================================
-- DONE! Your database is ready for Yellow Network state channels! 🚀
-- ============================================================================
