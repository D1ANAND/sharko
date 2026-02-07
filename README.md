# 🟡 Yellow Prediction Markets - Complete Implementation Guide

A decentralized prediction market platform built with React, Node.js, Supabase, and Ethereum smart contracts.

## 🎯 Features

- ✅ **React Frontend** - Modern UI with wallet connection
- ✅ **Supabase Database** - PostgreSQL for bets, markets, and leaderboard
- ✅ **Automatic Settlement** - Edge Functions poll Manifold for resolutions
- ✅ **On-Chain Betting** - Smart contract on Arbitrum Sepolia
- ✅ **Real-time Leaderboard** - Track PnL, wins, and performance

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- MetaMask or compatible Web3 wallet
- Arbitrum Sepolia testnet ETH

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd yellow-manifold-team
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-migration.sql`
3. Get your credentials from **Project Settings** → **API**:
   - Project URL
   - Service Role Key (not anon key!)

### 3. Configure Environment

Create `.env` file:

```env
# Contract
CUSTODY_ADDRESS=0x4bA6e7b6ecFDc54d5C56B1f764a261D5F2BFb8da
ORACLE_KEY=your-private-key

# RPC
ARB_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_MAINNET=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
PORT=3001
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

Open http://localhost:5173

## 📊 Database Schema

### Tables Created by Migration

#### `tracked_markets`
Stores markets that have bets placed on them.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Manifold market ID (PK) |
| created_at | TIMESTAMPTZ | When first tracked |
| last_checked | TIMESTAMPTZ | Last resolution check |
| settled | BOOLEAN | Settlement status |

#### `bets`
Records all bets placed by users.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Auto-increment ID (PK) |
| market_id | TEXT | References tracked_markets |
| user_address | TEXT | Wallet address |
| side | BOOLEAN | true=YES, false=NO |
| amount | NUMERIC | Bet amount in ETH |
| created_at | TIMESTAMPTZ | When bet was placed |

#### `leaderboard`
Tracks user performance and PnL.

| Column | Type | Description |
|--------|------|-------------|
| address | TEXT | Wallet address (PK) |
| pnl | REAL | Profit/Loss in ETH |
| bets | INTEGER | Total bets placed |
| wins | INTEGER | Winning bets |
| losses | INTEGER | Losing bets |
| volume | REAL | Total volume traded |
| created_at | TIMESTAMPTZ | First bet timestamp |
| updated_at | TIMESTAMPTZ | Last update |

## 🔄 How Automatic Settlement Works

### Flow

1. **User places bet** → Frontend calls `/api/bet` → Market added to `tracked_markets`
2. **Supabase Cron** (every 5 min) → Triggers Edge Function
3. **Edge Function** → Queries unsettled markets → Calls `/api/settle/:marketId` for each
4. **Backend** → Checks Manifold → Settles on-chain → Updates leaderboard → Marks settled

### Setting Up Auto-Settlement

See [SUPABASE_EDGE_FUNCTION.md](./SUPABASE_EDGE_FUNCTION.md) for detailed instructions.

**Quick version:**

1. Create Edge Function:
```bash
supabase functions new settle-markets
```

2. Deploy:
```bash
supabase functions deploy settle-markets --no-verify-jwt
```

3. Set up cron in Supabase SQL Editor:
```sql
SELECT cron.schedule(
  'settle-markets-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/settle-markets',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_ANON_KEY'),
    body := '{}'::jsonb
  );
  $$
);
```

## 🏗️ Architecture

```
┌─────────────┐
│   React     │  User places bet
│  Frontend   │────────────────┐
└─────────────┘                │
                               ▼
┌─────────────┐         ┌─────────────┐
│  Supabase   │◄────────│   Node.js   │
│  Database   │         │   Backend   │
└─────────────┘         └─────────────┘
      ▲                        │
      │                        ▼
      │                 ┌─────────────┐
      │                 │  Ethereum   │
      │                 │   Contract  │
      │                 └─────────────┘
      │
┌─────────────┐
│  Supabase   │  Every 5 min
│ Edge Func   │  Check for resolved markets
└─────────────┘
```

## 📁 Project Structure

```
yellow-manifold-team/
├── public/                 # React frontend
│   ├── App.tsx            # Main React component
│   ├── main.tsx           # React entry point
│   ├── styles.css         # Styles
│   └── index.html         # HTML template
├── src/                   # Backend
│   ├── server.ts          # Express server + API endpoints
│   ├── supabase.ts        # Supabase client
│   ├── leaderboard.ts     # Leaderboard logic
│   ├── manifold.ts        # Manifold API client
│   ├── chain.ts           # Blockchain client
│   ├── ens.ts             # ENS resolution
│   └── yellow.ts          # Yellow Network integration
├── contract/              # Smart contracts
├── supabase-migration.sql # Database schema
└── package.json
```

## 🔌 API Endpoints

### `GET /api/markets`
Returns active Manifold markets.

### `POST /api/bet`
Tracks a market when a bet is placed.

**Body:**
```json
{
  "marketId": "manifold-market-id"
}
```

### `POST /api/settle/:marketId`
Settles a resolved market.

**Process:**
1. Fetches resolution from Manifold
2. Calls `settleMarket` on smart contract
3. Reads bets from Supabase
4. Updates leaderboard
5. Marks market as settled

### `GET /api/leaderboard`
Returns top 10 players and stats.

## 🛠️ Development

### Backend Only
```bash
npm run dev
```

### Frontend Only
```bash
npm run dev:frontend
```

### Build
```bash
npm run build
```

### TypeScript Compilation
```bash
npx tsc
```

## 🧪 Testing Settlement Manually

```bash
curl -X POST http://localhost:3001/api/settle/MARKET_ID
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `CUSTODY_ADDRESS` | Smart contract address | ✅ |
| `ORACLE_KEY` | Private key for settlement | ✅ |
| `ARB_RPC` | Arbitrum Sepolia RPC URL | ✅ |
| `ALCHEMY_MAINNET` | Mainnet RPC for ENS | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | ✅ |
| `PORT` | Backend port | Optional (default: 3001) |

## 🔐 Security Notes

- **Never commit `.env`** - It's in `.gitignore`
- **Use SERVICE_ROLE_KEY** only in backend, never in frontend
- **RLS policies** are enabled on all Supabase tables
- **Oracle key** should be kept secure and have minimal ETH

## 📚 Documentation

- [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md) - Database setup guide
- [SUPABASE_EDGE_FUNCTION.md](./SUPABASE_EDGE_FUNCTION.md) - Auto-settlement setup
- [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) - SQLite → Supabase migration notes

## 🐛 Troubleshooting

### "Supabase credentials not found"
- Check `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Restart the server after updating `.env`

### "Market cancelled" error
- This is expected for cancelled markets
- They won't be settled on-chain

### Bets not appearing in database
- Ensure `tracked_markets` and `bets` tables exist
- Check RLS policies allow service role access
- Verify `/api/bet` is being called after transaction

### Edge Function not running
- Check cron job is scheduled in Supabase
- Verify `BACKEND_URL` environment variable
- Check Edge Function logs in Supabase dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT

## 🔗 Links

- [Supabase Docs](https://supabase.com/docs)
- [Viem Docs](https://viem.sh)
- [Manifold API](https://docs.manifold.markets/api)
- [Arbitrum Sepolia](https://sepolia.arbiscan.io/)

---

**Built with ❤️ using React, Supabase, and Ethereum**
