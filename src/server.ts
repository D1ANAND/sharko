import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseAbi, parseAbiItem, keccak256, toHex, parseEther } from 'viem';
import { publicClient, walletClient } from './chain';
import { getMarkets, getMarketResolution } from './manifold';
import { leaderboard } from './leaderboard';
import { getUserProfile } from './ens';
import { yellowClient } from './yellow';
import { supabase } from './supabase';
import { sessionManager } from './session';

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

// Fee estimation
app.get('/api/fees', async (req, res) => {
  try {
    const fees = await publicClient.estimateFeesPerGas();
    res.json({
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: (fees.maxPriorityFeePerGas ?? 0n).toString(),
    });
  } catch (error) {
    console.error('Fee estimation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
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

// ========== SESSION / STATE CHANNEL ENDPOINTS ==========

// Open a new session (Yellow state channel)
app.post('/api/session/open', async (req, res) => {
  try {
    const { userAddress, depositAmount } = req.body as { userAddress: string; depositAmount: number };

    if (!userAddress || !depositAmount) {
      return res.status(400).json({ error: 'userAddress and depositAmount are required' });
    }

    const session = await sessionManager.openSession(userAddress, depositAmount);

    if (!session) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    return res.json({
      success: true,
      session: {
        id: session.id,
        balance: session.current_balance,
        deposit: session.initial_deposit,
      },
    });
  } catch (error) {
    console.error('Session open error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get active session for a user
app.get('/api/session/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    const session = await sessionManager.getActiveSession(userAddress);

    if (!session) {
      return res.json({ session: null });
    }

    return res.json({
      session: {
        id: session.id,
        balance: session.current_balance,
        deposit: session.initial_deposit,
        totalBetAmount: session.total_bet_amount,
        status: session.status,
        openedAt: session.opened_at,
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Place a bet within a session (off-chain)
app.post('/api/session/bet', async (req, res) => {
  try {
    const { sessionId, marketId, userAddress, side, amount } = req.body as {
      sessionId: string;
      marketId: string;
      userAddress: string;
      side: boolean;
      amount: number;
    };

    if (!sessionId || !marketId || !userAddress || side === undefined || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Track the market
    await supabase
      .from('tracked_markets')
      .upsert({ id: marketId }, { onConflict: 'id' });

    // Place bet in session
    const result = await sessionManager.placeBet(sessionId, marketId, userAddress, side, amount);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to place bet' });
    }

    return res.json({
      success: true,
      betId: result.bet_id,
      newBalance: result.new_balance,
    });
  } catch (error) {
    console.error('Session bet error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Close a session and prepare for settlement
app.post('/api/session/close', async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId: string };

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await sessionManager.closeSession(sessionId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to close session' });
    }

    return res.json({
      success: true,
      finalBalance: result.final_balance,
      message: 'Session marked for closing. Please withdraw your funds on-chain.',
    });
  } catch (error) {
    console.error('Session close error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Finalize session after on-chain withdrawal
app.post('/api/session/finalize', async (req, res) => {
  try {
    const { sessionId, txHash } = req.body as { sessionId: string; txHash: string };

    if (!sessionId || !txHash) {
      return res.status(400).json({ error: 'sessionId and txHash are required' });
    }

    const success = await sessionManager.finalizeSession(sessionId, txHash);

    if (!success) {
      return res.status(500).json({ error: 'Failed to finalize session' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Session finalize error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Track market when bet is placed (legacy endpoint - kept for compatibility)
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

    // 4. Settle session bets for this market
    const sessionBetsSettled = await sessionManager.settleBetsForMarket(marketId, resolvedYes);
    console.log(`Settled ${sessionBetsSettled} session bets`);

    // 5. Mark market as settled in tracked_markets
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
      betsProcessed: bets ? bets.length : 0,
      sessionBetsSettled,
    });
  } catch (error) {
    console.error('Settlement error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ENS profile (L1 mainnet resolution; works for Sepolia/Mainnet addresses)
app.get('/api/ens/profile', async (req, res) => {
  try {
    const address = (req.query.address as string)?.toLowerCase();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Valid address query required' });
    }
    const chainId = req.query.chainId != null ? Number(req.query.chainId) : undefined;
    const profile = await getUserProfile(address, chainId != null && !Number.isNaN(chainId) ? { chainId } : undefined);
    res.json(profile);
  } catch (error) {
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
