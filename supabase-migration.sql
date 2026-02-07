-- Supabase Migration for Leaderboard Table
-- Run this in your Supabase SQL Editor

-- Create the leaderboard table
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

-- Create an index on pnl for faster sorting
CREATE INDEX IF NOT EXISTS idx_leaderboard_pnl ON leaderboard(pnl DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access to everyone
CREATE POLICY "Allow public read access"
  ON leaderboard
  FOR SELECT
  USING (true);

-- Create a policy to allow insert/update from authenticated service role
-- (Your backend will use the service role key for writes)
CREATE POLICY "Allow service role write access"
  ON leaderboard
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_leaderboard_updated_at
  BEFORE UPDATE ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
