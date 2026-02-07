import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseAbi, parseAbiItem, keccak256, toHex } from 'viem';
import { publicClient, walletClient } from './chain';
import { getMarkets, getMarketResolution } from './manifold';
import { leaderboard } from './leaderboard';
import { yellowClient } from './yellow';
import { supabase } from './supabase';

const CUSTODY_ADDRESS = (process.env.CUSTODY_ADDRESS || '0x0') as `0x${string}`;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect Yellow on startup (commented out for debugging)
yellowClient.connect();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', custody: CUSTODY_ADDRESS });
});

// Markets
app.get('/api/markets', async (req, res) => {
  try {
    const markets = await getMarkets();
    const activeMarkets = markets.filter(m => !m.isResolved).slice(0, 15);
    res.json(activeMarkets);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Track market when bet is placed
app.post('/api/bet', async (req, res) => {
  try {
    const { marketId } = req.body as { marketId: string };
    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    await supabase
      .from('tracked_markets')
      .upsert({ id: marketId }, { onConflict: 'id' });

    return res.json({ success: true });
  } catch (error) {
    console.error('Supabase upsert error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Settle market
app.post('/api/settle/:marketId', async (req, res) => {
  try {
    const marketId = req.params.marketId;
    console.log(`Settling market: ${marketId}`);

    // Get Manifold resolution
    const resolution = await getMarketResolution(marketId);
    if (resolution.outcome === 'CANCEL') {
      return res.status(400).json({ error: 'Market cancelled' });
    }

    const resolvedYes = resolution.outcome === 'YES';
    const marketIdBytes = keccak256(toHex(marketId));

    // 1. Call settleMarket on PredictionCustody
    const hash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: parseAbi(['function settleMarket(bytes32 marketId, bool resolvedYes)']),
      functionName: 'settleMarket',
      args: [marketIdBytes, resolvedYes]
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Settled tx: ${hash}`);

    // 2. Load bets for this market from Supabase
    const { data: bets, error } = await supabase
      .from('bets')
      .select('user_address, side, amount')
      .eq('market_id', marketId);

    if (error) {
      console.error('Error loading bets from Supabase:', error);
      throw error;
    }

    console.log(`Found ${bets?.length || 0} bets in Supabase`);

    // 3. For each bet, compute PnL and update leaderboard
    if (bets && bets.length > 0) {
      for (const b of bets) {
        const user = b.user_address as string;
        const side = b.side as boolean;
        const amount = Number(b.amount); // assume stored as numeric ETH

        const won = side === resolvedYes;
        const pnl = won ? amount : -amount;

        await leaderboard.addBet(user, pnl, won, amount);
      }
    }

    // 4. Mark market as settled in tracked_markets
    await supabase
      .from('tracked_markets')
      .update({
        settled: true,
        last_checked: new Date().toISOString()
      })
      .eq('id', marketId);

    res.json({
      success: true,
      hash,
      outcome: resolution.outcome,
      betsProcessed: bets ? bets.length : 0
    });
  } catch (error) {
    console.error('Settlement error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await leaderboard.getTop10();
    const stats = await leaderboard.getStats();
    res.json({ leaders, stats });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Yellow relay (optional)
app.post('/api/yellow/relay', (req, res) => {
  yellowClient.send(req.body);
  res.json({ relayed: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {


});

// Graceful shutdown
process.on('SIGTERM', () => {
  yellowClient.disconnect();
  process.exit(0);
});
