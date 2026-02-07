import Database from 'better-sqlite3';
import { getUserProfile } from './ens';

const db = new Database('prediction.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    address TEXT PRIMARY KEY,
    pnl REAL DEFAULT 0,
    bets INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    volume REAL DEFAULT 0
  )
`);

export class Leaderboard {
  async addBet(address: string, pnlChange: number, won: boolean, amount: number) {
    const existing = db.prepare('SELECT * FROM leaderboard WHERE address=?').get(address) as any;
    
    const newPnL = (existing?.pnl || 0) + pnlChange;
    const newBets = (existing?.bets || 0) + 1;
    const newWins = (existing?.wins || 0) + (won ? 1 : 0);
    const newLosses = (existing?.losses || 0) + (won ? 0 : 1);
    const newVolume = (existing?.volume || 0) + Math.abs(amount);
    
    db.prepare(`
      INSERT OR REPLACE INTO leaderboard (address, pnl, bets, wins, losses, volume)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(address, newPnL, newBets, newWins, newLosses, newVolume);
  }
  
  async getTop10() {
    const raw = db.prepare(`
      SELECT * FROM leaderboard 
      ORDER BY pnl DESC 
      LIMIT 10
    `).all() as any[];
    
    const profiles = await Promise.all(
      raw.map(async (r) => {
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
  }
  
  getStats() {
    return db.prepare('SELECT COUNT(*) as users, SUM(bets) as totalBets, SUM(volume) as totalVolume FROM leaderboard').get();
  }
}

export const leaderboard = new Leaderboard();
