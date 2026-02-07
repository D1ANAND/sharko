# System Architecture Diagram

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REACT FRONTEND                              │
│  - App.tsx (wallet connection, betting UI)                      │
│  - Displays markets from Manifold                               │
│  - Shows leaderboard from Supabase                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │  ETHEREUM         │   │  NODE.JS BACKEND  │
        │  SMART CONTRACT   │   │  (Express API)    │
        │                   │   │                   │
        │  placeBet()       │◄──│  POST /api/bet    │
        │  settleMarket()   │   │  POST /api/settle │
        │  claim()          │   │  GET /api/markets │
        └───────────────────┘   │  GET /api/leaderboard │
                                └───────────────────┘
                                          │
                                          ▼
                                ┌───────────────────┐
                                │  SUPABASE         │
                                │  (PostgreSQL)     │
                                │                   │
                                │  - tracked_markets│
                                │  - bets           │
                                │  - leaderboard    │
                                └───────────────────┘
                                          ▲
                                          │
                                ┌─────────┴─────────┐
                                │                   │
                    ┌───────────────────┐   ┌───────────────────┐
                    │  SUPABASE         │   │  MANIFOLD API     │
                    │  EDGE FUNCTION    │   │                   │
                    │                   │   │  Market data      │
                    │  settle-markets   │──▶│  Resolution status│
                    └───────────────────┘   └───────────────────┘
                            ▲
                            │
                    ┌───────────────────┐
                    │  SUPABASE CRON    │
                    │  (Every 5 min)    │
                    └───────────────────┘
```

## Betting Flow

```
1. USER clicks "YES" or "NO"
   │
   ▼
2. FRONTEND sends transaction to ETHEREUM CONTRACT
   │
   ▼
3. CONTRACT emits BetPlaced event
   │
   ▼
4. FRONTEND calls POST /api/bet with marketId
   │
   ▼
5. BACKEND inserts into SUPABASE tracked_markets
   │
   ▼
6. Market is now tracked for resolution
```

## Settlement Flow

```
1. CRON JOB triggers every 5 minutes
   │
   ▼
2. EDGE FUNCTION queries tracked_markets WHERE settled = false
   │
   ▼
3. For each market:
   │
   ├─▶ Call POST /api/settle/:marketId
   │
   ▼
4. BACKEND:
   │
   ├─▶ Query MANIFOLD API for resolution
   │
   ├─▶ If resolved:
   │   │
   │   ├─▶ Call settleMarket() on ETHEREUM CONTRACT
   │   │
   │   ├─▶ Read bets from SUPABASE bets table
   │   │
   │   ├─▶ Calculate PnL for each bet
   │   │
   │   ├─▶ Update SUPABASE leaderboard
   │   │
   │   └─▶ Mark market as settled in tracked_markets
   │
   └─▶ Update last_checked timestamp
```

## Database Relationships

```
tracked_markets
├── id (PK)
├── created_at
├── last_checked
└── settled

         │
         │ (1:N)
         ▼

bets
├── id (PK)
├── market_id (FK → tracked_markets.id)
├── user_address
├── side
├── amount
└── created_at

         │
         │ (N:1)
         ▼

leaderboard
├── address (PK)
├── pnl
├── bets
├── wins
├── losses
├── volume
├── created_at
└── updated_at
```

## Component Breakdown

### Frontend (React)
```
public/
├── App.tsx
│   ├── useState (wallet, markets, leaderboard)
│   ├── useEffect (load data, polling)
│   ├── connectWallet()
│   ├── placeBet(marketId, side)
│   ├── loadMarkets()
│   └── loadLeaderboard()
│
├── main.tsx (entry point)
├── styles.css (styling)
└── index.html (mount point)
```

### Backend (Node.js)
```
src/
├── server.ts
│   ├── GET /api/markets
│   ├── POST /api/bet
│   ├── POST /api/settle/:marketId
│   └── GET /api/leaderboard
│
├── supabase.ts (client + types)
├── leaderboard.ts (business logic)
├── manifold.ts (API client)
├── chain.ts (blockchain client)
└── sync-bets.ts (utility)
```

### Database (Supabase)
```
Tables:
├── tracked_markets (markets with bets)
├── bets (all user bets)
└── leaderboard (user stats)

Functions:
└── update_leaderboard() (RPC callable)

Triggers:
└── update_updated_at (auto-timestamp)

Cron Jobs:
└── settle-markets-every-5-min
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│           FRONTEND                      │
│  React + TypeScript + Vite              │
│  viem (Ethereum interactions)           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           BACKEND                       │
│  Node.js + Express + TypeScript         │
│  viem (blockchain)                      │
│  @supabase/supabase-js (database)       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           DATABASE                      │
│  Supabase (PostgreSQL)                  │
│  Edge Functions (Deno)                  │
│  pg_cron (scheduled jobs)               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           BLOCKCHAIN                    │
│  Arbitrum Sepolia                       │
│  PredictionCustody.sol (Solidity)       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           EXTERNAL APIs                 │
│  Manifold Markets API                   │
│  Alchemy RPC                            │
│  ENS (Ethereum Name Service)            │
└─────────────────────────────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────┐
│  FRONTEND (Public)                      │
│  - No private keys                      │
│  - User signs with MetaMask             │
│  - Only public API calls                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  BACKEND (Server)                       │
│  - ORACLE_KEY (for settlement)          │
│  - SUPABASE_SERVICE_ROLE_KEY            │
│  - Environment variables (.env)         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SUPABASE (Database)                    │
│  - RLS policies enabled                 │
│  - Public read, service write           │
│  - Service role bypasses RLS            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  SMART CONTRACT (On-chain)              │
│  - Only oracle can settle               │
│  - Users can only bet/claim             │
│  - Immutable logic                      │
└─────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│  FRONTEND                               │
│  Vercel / Netlify / Static Host         │
│  https://your-app.vercel.app            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  BACKEND                                │
│  Railway / Render / VPS                 │
│  https://api.your-app.com               │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  SUPABASE                               │
│  Managed PostgreSQL + Edge Functions    │
│  https://your-project.supabase.co       │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  ETHEREUM                               │
│  Arbitrum Sepolia (Testnet)             │
│  Contract: 0x4bA6...Fb8da               │
└─────────────────────────────────────────┘
```
