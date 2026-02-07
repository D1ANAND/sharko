# 🆕 Fresh Supabase Project Setup

## Step-by-Step Guide

### 1. Create New Supabase Project
1. Go to https://supabase.com/dashboard
2. Click **"New project"**
3. Choose organization
4. Enter project details:
   - **Name:** `yellow-predictions` (or whatever you want)
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
5. Click **"Create new project"**
6. Wait 2-3 minutes for project to initialize

---

### 2. Run the Complete Migration

1. Once project is ready, click **"SQL Editor"** in sidebar
2. Click **"New query"**
3. Open `COMPLETE_SUPABASE_MIGRATION.sql`
4. Copy **ALL** content (Ctrl+A, Ctrl+C)
5. Paste into SQL Editor (Ctrl+V)
6. Click **"Run"** (or Ctrl+Enter)
7. Wait for success message (~5 seconds)

---

### 3. Get Your New Credentials

#### Get Project URL:
1. Go to **Settings** → **API**
2. Copy **Project URL**
   - Example: `https://xxxxx.supabase.co`

#### Get Service Role Key:
1. Still in **Settings** → **API**
2. Scroll to **Project API keys**
3. Copy **`service_role`** key (NOT the anon key!)
   - Starts with `eyJhbGc...`

---

### 4. Update Your `.env` File

Replace these lines in your `.env`:

```env
# Supabase
SUPABASE_URL=https://YOUR-NEW-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...YOUR-NEW-SERVICE-KEY...
```

---

### 5. Restart Backend

```bash
# Stop backend (Ctrl+C)
npm run dev
```

---

### 6. Verify It Works

You should see:
```
✅ Server running on port 3001
🟡 Yellow Network connected
```

Then test in your browser:
- Connect wallet
- Session should open successfully
- Place bets with no gas fees!

---

## What This Migration Includes

### Tables:
- ✅ `leaderboard` - User rankings
- ✅ `tracked_markets` - Markets being tracked
- ✅ `bets` - Original bets (backward compatibility)
- ✅ `sessions` - Yellow Network state channels
- ✅ `session_bets` - Off-chain bets

### Functions:
- ✅ `get_active_session()` - Get user's active session
- ✅ `place_session_bet()` - Place off-chain bet
- ✅ `settle_session_bets()` - Settle bets when market resolves
- ✅ `update_updated_at_column()` - Auto-update timestamps

### Security:
- ✅ Row Level Security (RLS) enabled
- ✅ Public read access
- ✅ Service role write access
- ✅ Performance indexes

---

## Verification

After running migration, test with these queries in SQL Editor:

```sql
-- Should return 5 tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should return 4 functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Should return empty (no sessions yet)
SELECT * FROM sessions;
```

All queries should run **without errors**! ✅

---

## Troubleshooting

### "Function already exists"
- This is OK! The migration uses `CREATE OR REPLACE`
- Safe to run multiple times

### "Permission denied"
- Make sure you're the project owner
- Check you're in the correct project

### Backend still shows errors
- Double-check `.env` has new URL and key
- Restart backend: `npm run dev`

---

## TL;DR

1. Create new Supabase project
2. Run `COMPLETE_SUPABASE_MIGRATION.sql` in SQL Editor
3. Copy new URL and service role key
4. Update `.env` file
5. Restart backend: `npm run dev`

**Done!** 🎉
