-- ============================================================================
-- Add win_rate, rank, and last_updated fields to leaderboard table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add new columns to leaderboard table
ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS win_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS rank INT4,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- Create index for rank queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leaderboard' 
AND column_name IN ('win_rate', 'rank', 'last_updated');
