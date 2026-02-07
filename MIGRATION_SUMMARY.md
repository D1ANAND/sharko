# Supabase Migration - Quick Reference

## Files Changed

### ✅ New Files Created
- `src/supabase.ts` - Supabase client configuration
- `supabase-migration.sql` - SQL migration script for Supabase
- `SUPABASE_MIGRATION.md` - Detailed migration guide

### ✏️ Modified Files
- `src/leaderboard.ts` - Replaced SQLite with Supabase queries
- `src/server.ts` - Made `getStats()` async
- `package.json` - Removed `better-sqlite3`, added `@supabase/supabase-js`
- `.env.example` - Added Supabase configuration variables
- `.gitignore` - Added `*.db` and `*.db-journal`

### 🗑️ Files to Remove (After Migration)
- `prediction.db` - Old SQLite database (delete after confirming Supabase works)

## Environment Variables Required

Add these to your `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Key Code Changes

### Before (SQLite)
```typescript
import Database from 'better-sqlite3';
const db = new Database('prediction.db');

// Synchronous operations
const result = db.prepare('SELECT * FROM leaderboard').all();
```

### After (Supabase)
```typescript
import { supabase } from './supabase';

// Asynchronous operations
const { data, error } = await supabase
  .from('leaderboard')
  .select('*');
```

## Quick Start

1. **Create Supabase project** at https://supabase.com
2. **Run migration SQL** in Supabase SQL Editor (from `supabase-migration.sql`)
3. **Add credentials** to `.env` file
4. **Install dependencies**: `npm install`
5. **Start server**: `npm run dev`
6. **Test** the leaderboard functionality

## API Changes

All methods in the `Leaderboard` class are now properly async:
- `addBet()` - Already was async ✅
- `getTop10()` - Already was async ✅
- `getStats()` - **NOW ASYNC** (was sync before) ⚠️

Make sure to `await` all three methods when calling them.

## Database Schema

The Supabase table has the same structure as SQLite, plus timestamps:

| Column | Type | Description |
|--------|------|-------------|
| address | TEXT | Primary key, user's wallet address |
| pnl | REAL | Profit and loss |
| bets | INTEGER | Total number of bets |
| wins | INTEGER | Number of winning bets |
| losses | INTEGER | Number of losing bets |
| volume | REAL | Total volume traded |
| created_at | TIMESTAMP | Auto-generated creation time |
| updated_at | TIMESTAMP | Auto-updated modification time |

## Benefits

- ☁️ Cloud-hosted (no local database files)
- 📈 Scalable for production
- 🔄 Real-time capabilities
- 🔐 Built-in authentication ready
- 💾 Automatic backups
- 🎯 PostgreSQL power

## Support

For detailed instructions, see `SUPABASE_MIGRATION.md`
