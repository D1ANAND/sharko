import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { parseAbi, parseAbiItem, keccak256, toHex } from 'viem';
import { publicClient, walletClient } from './chain';
import { getMarkets, getMarketResolution } from './manifold';
import { leaderboard } from './leaderboard';
import { yellowClient } from './yellow';

const CUSTODY_ADDRESS = (process.env.CUSTODY_ADDRESS || '0x0') as `0x${string}`;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect Yellow on startup (commented out for debugging)
// yellowClient.connect();

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

    // Settle on-chain
    const hash = await walletClient.writeContract({
      address: CUSTODY_ADDRESS,
      abi: parseAbi(['function settleMarket(bytes32 marketId, bool resolvedYes)']),
      functionName: 'settleMarket',
      args: [marketIdBytes, resolvedYes]
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Settled tx: ${hash}`);

    // Get all bets from events
    const logs = await publicClient.getLogs({
      address: CUSTODY_ADDRESS,
      event: parseAbiItem('event BetPlaced(bytes32 indexed marketId, address indexed user, bool side, uint256 amount)'),
      args: { marketId: marketIdBytes },
      fromBlock: 0n
    });

    console.log(`Found ${logs.length} bets`);

    // Update leaderboard
    for (const log of logs) {
      const { user, side, amount } = log.args;
      const won = side === resolvedYes;
      const pnl = won ? Number(amount) / 1e18 : -(Number(amount) / 1e18);

      await leaderboard.addBet(user as string, pnl, won, Number(amount) / 1e18);
    }

    res.json({
      success: true,
      hash,
      outcome: resolution.outcome,
      betsProcessed: logs.length
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
    const stats = leaderboard.getStats();
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
  console.log(`✅ Backend running: http://localhost:${PORT}`);
  console.log(`   Custody: ${CUSTODY_ADDRESS}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  yellowClient.disconnect();
  process.exit(0);
});
