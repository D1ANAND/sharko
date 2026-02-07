# Migration from SQLite to Supabase

This guide will help you migrate from the local SQLite database to Supabase.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Set Up Supabase Project

1. Go to https://supabase.com and sign in
2. Create a new project or use an existing one
3. Wait for the project to finish setting up

## Step 2: Run the Migration SQL

1. In your Supabase dashboard, go to the **SQL Editor**
2. Open the file `supabase-migration.sql` from this project
3. Copy the entire contents
4. Paste it into the SQL Editor in Supabase
5. Click **Run** to execute the migration

This will create:
- The `leaderboard` table with all necessary columns
- Indexes for performance optimization
- Row Level Security (RLS) policies
- Automatic timestamp updates

## Step 3: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 4: Update Your Environment Variables

1. Open your `.env` file (create one if it doesn't exist, based on `.env.example`)
2. Add the following lines:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with your actual Supabase credentials from Step 3.

## Step 5: Install Dependencies

Run the following command to ensure all dependencies are installed:

```bash
npm install
```

## Step 6: (Optional) Migrate Existing Data

If you have existing data in `prediction.db` that you want to migrate to Supabase:

1. Install a SQLite viewer or use a command-line tool to export your data
2. Export the `leaderboard` table to CSV or JSON
3. In Supabase dashboard, go to **Table Editor** → **leaderboard**
4. Use the **Insert** → **Import data from CSV** option to import your data

Alternatively, you can write a migration script to programmatically transfer the data.

## Step 7: Remove SQLite Dependencies (Already Done)

The following changes have already been made:
- ✅ Removed `better-sqlite3` from `package.json`
- ✅ Updated `src/leaderboard.ts` to use Supabase
- ✅ Created `src/supabase.ts` for Supabase client configuration
- ✅ Updated `src/server.ts` to handle async `getStats()`

## Step 8: Clean Up (Optional)

After confirming everything works with Supabase:

1. You can safely delete the `prediction.db` file
2. Run `npm uninstall better-sqlite3 @types/better-sqlite3` to remove unused packages

## Step 9: Test Your Application

1. Start your development server:
```bash
npm run dev
```

2. Test the following features:
   - Placing bets (should update the leaderboard)
   - Viewing the leaderboard
   - Checking leaderboard stats

## Troubleshooting

### "Supabase credentials not found" warning
- Make sure you've added `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your `.env` file
- Restart your server after updating the `.env` file

### "relation 'leaderboard' does not exist" error
- Make sure you ran the migration SQL in Step 2
- Check that the table was created in the Supabase Table Editor

### Data not appearing in Supabase
- Check the browser console and server logs for errors
- Verify your RLS policies are set up correctly
- Make sure you're using the correct Supabase project

### Permission errors
- Ensure the RLS policies were created correctly
- For development, you can temporarily disable RLS on the table (not recommended for production)

## Benefits of Supabase

✅ **Cloud-hosted**: No need to manage database files  
✅ **Scalable**: Handles more concurrent users  
✅ **Real-time**: Can add real-time subscriptions for live leaderboard updates  
✅ **Backups**: Automatic backups and point-in-time recovery  
✅ **PostgreSQL**: More powerful than SQLite with advanced features  
✅ **Dashboard**: Easy-to-use web interface for data management  

## Next Steps

Consider enhancing your application with Supabase features:
- **Real-time subscriptions**: Update the leaderboard in real-time without polling
- **Authentication**: Add user authentication with Supabase Auth
- **Storage**: Store user avatars or other files with Supabase Storage
- **Edge Functions**: Add serverless functions for complex operations
