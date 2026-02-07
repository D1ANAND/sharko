# 🚀 Setup Checklist

Use this checklist to ensure everything is configured correctly.

## ✅ Prerequisites

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Git installed
- [ ] MetaMask or Web3 wallet installed
- [ ] Arbitrum Sepolia testnet ETH in wallet

## 📦 Installation

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Verify all dependencies installed without errors

## 🗄️ Supabase Setup

- [ ] Create Supabase account at https://supabase.com
- [ ] Create new Supabase project
- [ ] Copy Project URL from Project Settings → API
- [ ] Copy Service Role Key from Project Settings → API (NOT anon key!)
- [ ] Open SQL Editor in Supabase dashboard
- [ ] Copy entire contents of `supabase-migration.sql`
- [ ] Paste and run in SQL Editor
- [ ] Verify tables created:
  - [ ] `tracked_markets`
  - [ ] `bets`
  - [ ] `leaderboard`
- [ ] Check that indexes were created
- [ ] Verify RLS policies are enabled

## 🔐 Environment Variables

- [ ] Create `.env` file in project root
- [ ] Add `CUSTODY_ADDRESS` (smart contract address)
- [ ] Add `ORACLE_KEY` (private key for settlement)
- [ ] Add `ARB_RPC` (Arbitrum Sepolia RPC URL)
- [ ] Add `ALCHEMY_MAINNET` (Mainnet RPC for ENS)
- [ ] Add `SUPABASE_URL` (from Supabase dashboard)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard)
- [ ] Add `PORT=3001` (optional)
- [ ] Verify `.env` is in `.gitignore`

## 🏃 Running Locally

### Backend
- [ ] Open terminal in project directory
- [ ] Run `npm run dev`
- [ ] Verify server starts on port 3001
- [ ] Check for "Supabase credentials" warning (should not appear)
- [ ] Test health endpoint: `curl http://localhost:3001/api/health`

### Frontend
- [ ] Open second terminal
- [ ] Run `npm run dev:frontend`
- [ ] Verify Vite starts on port 5173
- [ ] Open http://localhost:5173 in browser
- [ ] Verify page loads without errors
- [ ] Check browser console for errors

## 🔗 Wallet Connection

- [ ] Click "Connect Wallet" button
- [ ] MetaMask popup appears
- [ ] Approve connection
- [ ] Wallet address displays in header
- [ ] Auto-deposit transaction appears
- [ ] Approve deposit transaction
- [ ] Transaction confirms

## 📊 Testing Betting

- [ ] Markets load and display
- [ ] Click "YES" or "NO" on a market
- [ ] MetaMask transaction popup appears
- [ ] Approve transaction
- [ ] Transaction confirms
- [ ] Success message appears
- [ ] Check Supabase dashboard:
  - [ ] Market appears in `tracked_markets` table
  - [ ] `settled` is `false`

## 🏆 Testing Leaderboard

- [ ] Leaderboard section displays
- [ ] Data loads (may be empty initially)
- [ ] After settlement, verify:
  - [ ] User appears in leaderboard
  - [ ] PnL is calculated correctly
  - [ ] Win/loss count is accurate

## 🤖 Automatic Settlement Setup

### Edge Function
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Run `supabase functions new settle-markets`
- [ ] Copy Edge Function code from `SUPABASE_EDGE_FUNCTION.md`
- [ ] Paste into `supabase/functions/settle-markets/index.ts`
- [ ] Deploy: `supabase functions deploy settle-markets --no-verify-jwt`
- [ ] Verify deployment successful

### Environment Variables (Edge Function)
- [ ] Go to Supabase Dashboard → Edge Functions
- [ ] Click on `settle-markets`
- [ ] Go to Settings
- [ ] Add `BACKEND_URL` (e.g., `http://localhost:3001` or production URL)
- [ ] Verify `SUPABASE_URL` is auto-populated
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is auto-populated

### Cron Job
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] Copy cron job SQL from `SUPABASE_EDGE_FUNCTION.md`
- [ ] Replace `your-project.supabase.co` with your actual URL
- [ ] Replace `YOUR_ANON_KEY` with your anon key
- [ ] Run the SQL
- [ ] Verify cron job created: `SELECT * FROM cron.job;`

### Testing Auto-Settlement
- [ ] Place a bet on a market
- [ ] Wait for market to resolve on Manifold
- [ ] Wait up to 5 minutes for cron to run
- [ ] Check Edge Function logs in Supabase
- [ ] Verify market is marked as `settled = true` in database
- [ ] Verify leaderboard updated with PnL

## 🧪 Manual Testing

### Test Settlement Endpoint
```bash
curl -X POST http://localhost:3001/api/settle/MARKET_ID
```
- [ ] Command runs without errors
- [ ] Response shows success or error message
- [ ] Check logs for settlement details

### Test Bet Tracking
```bash
curl -X POST http://localhost:3001/api/bet \
  -H "Content-Type: application/json" \
  -d '{"marketId":"test-market-123"}'
```
- [ ] Returns `{"success":true}`
- [ ] Market appears in `tracked_markets` table

### Test Markets Endpoint
```bash
curl http://localhost:3001/api/markets
```
- [ ] Returns array of markets
- [ ] Markets have `id`, `question`, `probability`, `volume`

### Test Leaderboard Endpoint
```bash
curl http://localhost:3001/api/leaderboard
```
- [ ] Returns `leaders` array and `stats` object
- [ ] Data structure matches expected format

## 🔍 Verification Checklist

### Database
- [ ] `tracked_markets` table has data
- [ ] `bets` table has data (after placing bets)
- [ ] `leaderboard` table has data (after settlement)
- [ ] Timestamps are correct
- [ ] Foreign key relationships work

### Smart Contract
- [ ] Contract deployed on Arbitrum Sepolia
- [ ] Oracle address is correct
- [ ] Can place bets on-chain
- [ ] Can settle markets (as oracle)
- [ ] Events are emitted correctly

### Frontend
- [ ] No console errors
- [ ] Wallet connects successfully
- [ ] Markets display correctly
- [ ] Betting works end-to-end
- [ ] Leaderboard updates
- [ ] UI is responsive

### Backend
- [ ] Server starts without errors
- [ ] All endpoints respond
- [ ] Supabase connection works
- [ ] Blockchain connection works
- [ ] Manifold API calls work
- [ ] Error handling works

## 📝 Optional Enhancements

- [ ] Set up bet syncing: `npm run sync-bets`
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway/Render
- [ ] Set up monitoring/logging
- [ ] Add error alerting
- [ ] Configure production RPC endpoints
- [ ] Set up CI/CD pipeline

## 🐛 Common Issues

### "Supabase credentials not found"
- [ ] Check `.env` file exists
- [ ] Verify `SUPABASE_URL` is set
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key!)
- [ ] Restart server after updating `.env`

### "Market cancelled" error
- [ ] This is expected for cancelled markets
- [ ] They won't be settled on-chain
- [ ] Check market status on Manifold

### Bets not in database
- [ ] Verify `/api/bet` is being called
- [ ] Check network tab in browser
- [ ] Run `npm run sync-bets` to backfill

### Edge Function not running
- [ ] Check cron job is scheduled
- [ ] Verify `BACKEND_URL` is correct
- [ ] Check Edge Function logs
- [ ] Test manually: `curl https://your-project.supabase.co/functions/v1/settle-markets`

### TypeScript errors
- [ ] Run `npm install` again
- [ ] Check `tsconfig.json` is correct
- [ ] Verify all types are imported

## ✅ Final Verification

- [ ] Backend runs: `npm run dev`
- [ ] Frontend runs: `npm run dev:frontend`
- [ ] Can connect wallet
- [ ] Can place bet
- [ ] Market tracked in database
- [ ] Can manually settle: `curl -X POST http://localhost:3001/api/settle/MARKET_ID`
- [ ] Leaderboard updates
- [ ] Edge Function deployed (optional)
- [ ] Cron job configured (optional)

## 🎉 You're Done!

If all items are checked, your prediction market platform is fully operational!

**Next Steps:**
1. Deploy to production (see README.md)
2. Monitor Edge Function logs
3. Test with real users
4. Iterate and improve

**Need Help?**
- Check `README.md` for detailed documentation
- See `SUPABASE_EDGE_FUNCTION.md` for auto-settlement
- Review `ARCHITECTURE.md` for system design
- Read `IMPLEMENTATION_COMPLETE.md` for implementation details
