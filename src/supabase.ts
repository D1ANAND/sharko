import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types for TypeScript
export interface LeaderboardEntry {
    address: string;
    pnl: number;
    bets: number;
    wins: number;
    losses: number;
    volume: number;
    created_at?: string;
    updated_at?: string;
}
