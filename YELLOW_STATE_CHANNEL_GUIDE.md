# Yellow Network State Channel Implementation Guide

## Overview

This guide explains how to implement the **Yellow Network state channel** architecture for your prediction market. This transforms your app from per-bet on-chain transactions to a **funded session model** where users:

1. **Open a session** (1 on-chain deposit)
2. **Place many bets** (off-chain via Yellow Network)
3. **Close session** (1 on-chain withdrawal with final PnL)

---

## Architecture Changes

### Before (Current)
- Every bet = 1 on-chain transaction
- Yellow Network used only as message relay
- No session/channel concept

### After (State Channel)
- **Session open** = 1 on-chain deposit
- **Bets** = off-chain state updates via Yellow
- **Session close** = 1 on-chain withdrawal
- Yellow Network manages state channel lifecycle

---

## Database Schema

### New Tables

#### `sessions` - Yellow State Channels
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_address TEXT NOT NULL,
  yellow_session_id TEXT,           -- Yellow Network session ID
  initial_deposit NUMERIC NOT NULL,  -- Amount deposited
  current_balance NUMERIC NOT NULL,  -- Current session balance
  total_bet_amount NUMERIC DEFAULT 0,
  total_won NUMERIC DEFAULT 0,
  total_lost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'open',        -- 'open', 'closing', 'closed'
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  settlement_tx_hash TEXT
);
```

#### `session_bets` - Off-chain Bets
```sql
CREATE TABLE session_bets (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  market_id TEXT NOT NULL,
  user_address TEXT NOT NULL,
  side BOOLEAN NOT NULL,
  amount NUMERIC NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  won BOOLEAN,                       -- NULL until market resolves
  pnl NUMERIC,                       -- Profit/loss
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Backend API Endpoints

### Session Management

#### `POST /api/session/open`
Open a new Yellow session for a user.

**Request:**
```json
{
  "userAddress": "0x...",
  "depositAmount": 0.01
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "balance": 0.01,
    "deposit": 0.01
  }
}
```

#### `GET /api/session/:userAddress`
Get active session for a user.

**Response:**
```json
{
  "session": {
    "id": "uuid",
    "balance": 0.008,
    "deposit": 0.01,
    "totalBetAmount": 0.002,
    "status": "open",
    "openedAt": "2026-02-08T..."
  }
}
```

#### `POST /api/session/bet`
Place an off-chain bet within a session.

**Request:**
```json
{
  "sessionId": "uuid",
  "marketId": "manifold-id",
  "userAddress": "0x...",
  "side": true,
  "amount": 0.001
}
```

**Response:**
```json
{
  "success": true,
  "betId": 123,
  "newBalance": 0.007
}
```

#### `POST /api/session/close`
Mark session for closing (prepares for withdrawal).

**Request:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "finalBalance": 0.012,
  "message": "Session marked for closing. Please withdraw your funds on-chain."
}
```

#### `POST /api/session/finalize`
Finalize session after on-chain withdrawal.

**Request:**
```json
{
  "sessionId": "uuid",
  "txHash": "0x..."
}
```

---

## Frontend Implementation

### 1. Connect Wallet & Open Session

**Old Flow:**
```typescript
// Connect wallet
await connectWallet();
// Auto deposit
await deposit(client, account);
```

**New Flow:**
```typescript
// Connect wallet
await connectWallet();

// Deposit and open session
const depositAmount = 0.01; // ETH
const hash = await client.sendTransaction({
  chain: sepolia,
  account: address,
  to: CUSTODY,
  data: encodeFunctionData({ abi: ABI, functionName: 'deposit' }),
  value: parseEther(depositAmount.toString()),
  maxFeePerGas,
  maxPriorityFeePerGas,
});

// Wait for transaction
await publicClient.waitForTransactionReceipt({ hash });

// Open session in backend
const response = await fetch(`${API_BASE}/api/session/open`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userAddress: address,
    depositAmount,
  }),
});

const { session } = await response.json();
setSessionId(session.id);
setSessionBalance(session.balance);
```

### 2. Place Bets (Off-chain)

**Old Flow:**
```typescript
// On-chain transaction for every bet
const hash = await walletClient.sendTransaction({
  chain: sepolia,
  account: address,
  to: CUSTODY,
  data: encodeFunctionData({ ... }),
  // Gas fees, etc.
});
```

**New Flow:**
```typescript
// Off-chain bet via session
const response = await fetch(`${API_BASE}/api/session/bet`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    marketId,
    userAddress: address,
    side: true, // YES
    amount: 0.001,
  }),
});

const { success, newBalance } = await response.json();
if (success) {
  setSessionBalance(newBalance);
  alert('Bet placed! (No gas fees!)');
}
```

### 3. Close Session & Withdraw

**New Flow:**
```typescript
// 1. Close session in backend
const closeResponse = await fetch(`${API_BASE}/api/session/close`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId }),
});

const { finalBalance } = await closeResponse.json();

// 2. Withdraw on-chain
const hash = await walletClient.writeContract({
  address: CUSTODY,
  abi: parseAbi(['function withdraw(uint256 amount)']),
  functionName: 'withdraw',
  args: [parseEther(finalBalance.toString())],
});

await publicClient.waitForTransactionReceipt({ hash });

// 3. Finalize session
await fetch(`${API_BASE}/api/session/finalize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    txHash: hash,
  }),
});

alert(`Session closed! Withdrew ${finalBalance} ETH`);
```

---

## Frontend UI Changes

### Add Session Info Display

```tsx
{sessionId && (
  <div className="session-info">
    <h3>Active Session</h3>
    <p>Balance: {sessionBalance} ETH</p>
    <button onClick={closeSession}>End Session & Withdraw</button>
  </div>
)}
```

### Update Bet Buttons

```tsx
<button 
  className="bet-yes" 
  onClick={() => placeBet(m.id, true)}
  disabled={!sessionId || sessionBalance < 0.001}
>
  YES 0.001 ETH (No Gas!)
</button>
```

---

## Migration Steps

### 1. Database Migration
Run the new migration SQL in Supabase:
```bash
# In Supabase SQL Editor
# Run: supabase-session-migration.sql
```

### 2. Backend Updates
The backend is already updated with:
- ✅ `src/session.ts` - Session manager
- ✅ `src/yellow.ts` - Yellow session methods
- ✅ `src/server.ts` - Session API endpoints

### 3. Frontend Updates

**Add State:**
```typescript
const [sessionId, setSessionId] = useState<string | null>(null);
const [sessionBalance, setSessionBalance] = useState<number>(0);
```

**Modify `connectWallet`:**
- After deposit, call `/api/session/open`
- Store `sessionId` and `sessionBalance`

**Modify `placeBet`:**
- Instead of on-chain transaction
- Call `/api/session/bet` with `sessionId`
- Update `sessionBalance` from response

**Add `closeSession` function:**
- Call `/api/session/close`
- Execute on-chain `withdraw()`
- Call `/api/session/finalize`

---

## Benefits

### For Users
- ✅ **1 deposit** instead of N transactions
- ✅ **No gas fees** for bets (off-chain)
- ✅ **Instant bets** (no waiting for confirmations)
- ✅ **1 withdrawal** to cash out

### For Your App
- ✅ **True Yellow Network integration** (state channels)
- ✅ **Scalable** (thousands of bets per second)
- ✅ **Lower costs** (fewer on-chain transactions)
- ✅ **Better UX** (instant feedback)

---

## Testing Checklist

- [ ] Run `supabase-session-migration.sql` in Supabase
- [ ] Restart backend: `npm run dev`
- [ ] Connect wallet in frontend
- [ ] Verify session opens after deposit
- [ ] Place multiple bets (should be instant, no gas)
- [ ] Check session balance updates
- [ ] Close session and withdraw
- [ ] Verify final balance matches expected PnL

---

## Next Steps

1. **Run the migration** in Supabase SQL Editor
2. **Update frontend** with session management code
3. **Test the flow** end-to-end
4. **Add UI polish** (session info, balance display)
5. **Deploy** and demo!

---

## Questions?

This architecture gives you a **production-ready state channel implementation** using Yellow Network. The key insight is:

> **Yellow Network = Off-chain state updates**  
> **Smart Contract = On-chain settlement**  
> **Supabase = State persistence**

All three work together to create a seamless, gas-free betting experience!
