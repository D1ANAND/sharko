import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database types for TypeScript
export interface LeaderboardEntry {
    address: string;
    pnl: number;
    bets: number;
    wins: number;
    losses: number;
    volume: number;
    win_rate?: number;      // new
    rank?: number;          // new
    last_updated?: string;  // new
    created_at?: string;
    updated_at?: string;
}


export interface TrackedMarket {
    id: string;
    created_at?: string;
    last_checked?: string;
    settled: boolean;
}

export interface Bet {
    id?: number;
    market_id: string;
    user_address: string;
    side: boolean;
    amount: number;
    created_at?: string;
}
