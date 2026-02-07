# Yellow Network State Channel Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Connect      │  │ Session Info │  │ Place Bet    │                  │
│  │ Wallet       │  │ Balance: 0.01│  │ (No Gas!)    │                  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘                  │
└─────────┼──────────────────────────────────────┼──────────────────────────┘
          │                                      │
          │ 1. deposit()                         │ 3. POST /api/session/bet
          │ (on-chain)                           │ (off-chain)
          ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN (Sepolia)                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              PredictionCustody Contract                           │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │ deposit()  │  │ placeBet() │  │ withdraw() │                 │  │
│  │  │ (0.01 ETH) │  │ (unused)   │  │ (final)    │                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │                                      │
          │ 2. Deposit confirmed                 │
          ▼                                      │
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express + Node.js)                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Session Manager                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │ openSession│  │ placeBet   │  │closeSession│                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│          │                    │                    │                     │
│          ▼                    ▼                    ▼                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Supabase Client                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│          │                    │                    │                     │
│          │                    │                    │                     │
│          ▼                    ▼                    ▼                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Yellow Network Client                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  │
│  │  │openSession │  │  send bet  │  │closeSession│                 │  │
│  │  └────────────┘  └────────────┘  └────────────┘                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      YELLOW NETWORK (WebSocket)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              State Channel Management                             │  │
│  │  • Session lifecycle (open/close)                                │  │
│  │  • Off-chain state updates                                       │  │
│  │  • Message relay between participants                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE (PostgreSQL)                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  sessions                                                         │  │
│  │  ┌─────────┬──────────┬─────────┬────────┬────────┐             │  │
│  │  │ id      │ user_addr│ balance │ status │ yellow │             │  │
│  │  ├─────────┼──────────┼─────────┼────────┼────────┤             │  │
│  │  │ uuid-1  │ 0x123... │ 0.008   │ open   │ y-123  │             │  │
│  │  └─────────┴──────────┴─────────┴────────┴────────┘             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  session_bets                                                     │  │
│  │  ┌─────────┬──────────┬─────────┬──────┬─────────┬──────┐       │  │
│  │  │ id      │ session  │ market  │ side │ amount  │ pnl  │       │  │
│  │  ├─────────┼──────────┼─────────┼──────┼─────────┼──────┤       │  │
│  │  │ 1       │ uuid-1   │ mkt-1   │ YES  │ 0.001   │ 0.001│       │  │
│  │  │ 2       │ uuid-1   │ mkt-2   │ NO   │ 0.001   │-0.001│       │  │
│  │  └─────────┴──────────┴─────────┴──────┴─────────┴──────┘       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### 1. Session Open (On-chain + Off-chain)
```
User                Frontend            Backend             Yellow          Blockchain      Supabase
 │                     │                   │                   │                 │              │
 │──Click Connect──────▶                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──deposit tx───────┼───────────────────┼─────────────────▶             │
 │                     │                   │                   │                 │              │
 │                     │                   │                   │              deposit()         │
 │                     │                   │                   │              0.01 ETH          │
 │                     │                   │                   │                 │              │
 │◀────Tx confirmed────│                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──POST /session/open──▶                │                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──open_session─────▶                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │◀──session_id──────│                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──INSERT sessions──┼─────────────────┼──────────────▶
 │                     │                   │                   │                 │              │
 │                     │◀──session created─│                   │                 │              │
 │                     │                   │                   │                 │              │
 │◀─Session ID + Balance                   │                   │                 │              │
```

### 2. Place Bet (Off-chain only!)
```
User                Frontend            Backend             Yellow          Blockchain      Supabase
 │                     │                   │                   │                 │              │
 │──Click YES──────────▶                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──POST /session/bet──▶                 │                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──place_session_bet()──────────────────────────────▶
 │                     │                   │  (checks balance, │                 │              │
 │                     │                   │   inserts bet,    │                 │              │
 │                     │                   │   updates balance)│                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──send bet message─▶                 │              │
 │                     │                   │                   │                 │              │
 │                     │◀──new balance─────│                   │                 │              │
 │                     │                   │                   │                 │              │
 │◀─Bet confirmed (instant!)               │                   │                 │              │
 │  No gas fees! ⚡                         │                   │                 │              │
```

### 3. Market Settlement (Automatic)
```
Backend             Yellow          Blockchain      Supabase
  │                   │                 │              │
  │──settleMarket()───┼─────────────────▶             │
  │                   │              settle()          │
  │                   │                 │              │
  │──settle_session_bets()──────────────┼──────────────▶
  │  (updates all bets for market,      │              │
  │   calculates PnL,                   │              │
  │   updates session balances)         │              │
  │                   │                 │              │
```

### 4. Session Close (Off-chain + On-chain)
```
User                Frontend            Backend             Yellow          Blockchain      Supabase
 │                     │                   │                   │                 │              │
 │──Click End Session──▶                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──POST /session/close──▶               │                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──UPDATE status────┼─────────────────┼──────────────▶
 │                     │                   │  = 'closing'      │                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──close_session────▶                 │              │
 │                     │                   │                   │                 │              │
 │                     │◀──final balance───│                   │                 │              │
 │                     │                   │                   │                 │              │
 │◀─Final: 0.012 ETH───│                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──withdraw tx──────┼───────────────────┼─────────────────▶             │
 │                     │                   │                   │              withdraw()        │
 │                     │                   │                   │              0.012 ETH         │
 │                     │                   │                   │                 │              │
 │◀────Tx confirmed────│                   │                   │                 │              │
 │                     │                   │                   │                 │              │
 │                     │──POST /session/finalize──▶            │                 │              │
 │                     │                   │                   │                 │              │
 │                     │                   │──UPDATE status────┼─────────────────┼──────────────▶
 │                     │                   │  = 'closed'       │                 │              │
 │                     │                   │                   │                 │              │
 │◀─Session closed─────│                   │                   │                 │              │
```

## Key Insights

### Gas Savings
```
Traditional Approach:
- Connect: 0 gas
- Deposit: ~50,000 gas
- Bet 1: ~100,000 gas
- Bet 2: ~100,000 gas
- Bet 3: ~100,000 gas
- Bet 4: ~100,000 gas
- Bet 5: ~100,000 gas
- Withdraw: ~50,000 gas
TOTAL: ~600,000 gas ≈ $30 (at 50 gwei)

State Channel Approach:
- Connect: 0 gas
- Deposit + Open Session: ~50,000 gas
- Bet 1-5: 0 gas (off-chain!)
- Close + Withdraw: ~50,000 gas
TOTAL: ~100,000 gas ≈ $5 (at 50 gwei)

SAVINGS: $25 (83% reduction!)
```

### Performance
```
Traditional:
- Bet confirmation: 12-15 seconds (block time)
- User experience: Wait for each bet to confirm

State Channel:
- Bet confirmation: <100ms (database write)
- User experience: Instant feedback, no waiting!
```

### Scalability
```
Traditional:
- Limited by blockchain throughput (~15 TPS on Sepolia)
- Each bet = 1 transaction

State Channel:
- Limited by database throughput (~10,000 TPS)
- Bets are database writes, not blockchain transactions
- Only 2 blockchain transactions per session (open + close)
```
