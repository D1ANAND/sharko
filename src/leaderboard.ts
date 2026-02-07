import { supabase, LeaderboardEntry } from './supabase';
import { getUserProfile } from './ens';

export class Leaderboard {
  async addBet(address: string, pnlChange: number, won: boolean, amount: number) {
    try {
      // Fetch existing entry
      const { data: existing, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('address', address)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is okay
        console.error('Error fetching leaderboard entry:', fetchError);
        throw fetchError;
      }

      const newPnL = (existing?.pnl || 0) + pnlChange;
      const newBets = (existing?.bets || 0) + 1;
      const newWins = (existing?.wins || 0) + (won ? 1 : 0);
      const newLosses = (existing?.losses || 0) + (won ? 0 : 1);
      const newVolume = (existing?.volume || 0) + Math.abs(amount);

      // Upsert the entry
      const { error: upsertError } = await supabase
        .from('leaderboard')
        .upsert({
          address,
          pnl: newPnL,
          bets: newBets,
          wins: newWins,
          losses: newLosses,
          volume: newVolume,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'address'
        });

      if (upsertError) {
        console.error('Error upserting leaderboard entry:', upsertError);
        throw upsertError;
      }
    } catch (error) {
      console.error('Error in addBet:', error);
      throw error;
    }
  }

  async getTop10() {
    try {
      const { data: raw, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('pnl', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching top 10:', error);
        throw error;
      }

      if (!raw || raw.length === 0) {
        return [];
      }

      const profiles = await Promise.all(
        raw.map(async (r: LeaderboardEntry) => {
          const profile = await getUserProfile(r.address);
          return {
            ...profile,
            pnl: r.pnl,
            bets: r.bets,
            wins: r.wins,
            losses: r.losses,
            winRate: r.bets > 0 ? (r.wins / r.bets * 100).toFixed(1) : '0.0',
            volume: r.volume
          };
        })
      );

      return profiles;
    } catch (error) {
      console.error('Error in getTop10:', error);
      return [];
    }
  }

  async getStats() {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('address, bets, volume');

      if (error) {
        console.error('Error fetching stats:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return { users: 0, totalBets: 0, totalVolume: 0 };
      }

      const users = data.length;
      const totalBets = data.reduce((sum, entry) => sum + (entry.bets || 0), 0);
      const totalVolume = data.reduce((sum, entry) => sum + (entry.volume || 0), 0);

      return { users, totalBets, totalVolume };
    } catch (error) {
      console.error('Error in getStats:', error);
      return { users: 0, totalBets: 0, totalVolume: 0 };
    }
  }
}

export const leaderboard = new Leaderboard();
