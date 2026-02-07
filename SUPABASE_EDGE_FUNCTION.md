# Supabase Edge Function for Market Resolution

This document explains how to set up the Supabase Edge Function that automatically checks for resolved markets and triggers settlement.

## Prerequisites

- Supabase project with CLI installed
- Backend server running and accessible

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

## Step 2: Initialize Supabase Functions

In your project directory:

```bash
supabase functions new settle-markets
```

## Step 3: Create the Edge Function

Create or update `supabase/functions/settle-markets/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BACKEND_BASE = Deno.env.get('BACKEND_URL') || 'http://localhost:3001'

serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all unsettled markets
    const { data: markets, error } = await supabase
      .from('tracked_markets')
      .select('id')
      .eq('settled', false)

    if (error) {
      throw error
    }

    console.log(`Found ${markets?.length || 0} unsettled markets`)

    const results = []

    // Try to settle each market
    if (markets && markets.length > 0) {
      for (const market of markets) {
        try {
          const response = await fetch(`${BACKEND_BASE}/api/settle/${market.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const data = await response.json()
          
          if (response.ok) {
            results.push({
              marketId: market.id,
              success: true,
              data,
            })
            console.log(`✅ Settled market ${market.id}`)
          } else {
            results.push({
              marketId: market.id,
              success: false,
              error: data.error || 'Unknown error',
            })
            console.log(`❌ Failed to settle market ${market.id}: ${data.error}`)
          }
        } catch (err) {
          results.push({
            marketId: market.id,
            success: false,
            error: (err as Error).message,
          })
          console.error(`❌ Error settling market ${market.id}:`, err)
        }

        // Update last_checked timestamp
        await supabase
          .from('tracked_markets')
          .update({ last_checked: new Date().toISOString() })
          .eq('id', market.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        marketsChecked: markets?.length || 0,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
```

## Step 4: Deploy the Edge Function

```bash
supabase functions deploy settle-markets --no-verify-jwt
```

## Step 5: Set Environment Variables

In your Supabase dashboard, go to **Edge Functions** → **settle-markets** → **Settings** and add:

- `BACKEND_URL`: Your backend URL (e.g., `https://your-backend.com` or `http://localhost:3001` for local testing)
- `SUPABASE_URL`: Automatically available
- `SUPABASE_SERVICE_ROLE_KEY`: Automatically available

## Step 6: Set Up Cron Job

In your Supabase dashboard:

1. Go to **Database** → **Cron Jobs** (or use the SQL Editor)
2. Run this SQL:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to run every 5 minutes
SELECT cron.schedule(
  'settle-markets-every-5-min',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/settle-markets',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

Replace:
- `your-project.supabase.co` with your actual Supabase project URL
- `YOUR_ANON_KEY` with your anon key from Project Settings → API

## Step 7: Test the Edge Function

You can manually trigger it:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/settle-markets \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Or test locally:

```bash
supabase functions serve settle-markets
```

Then in another terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/settle-markets
```

## How It Works

1. **Cron job** runs every 5 minutes
2. **Edge Function** queries `tracked_markets` for unsettled markets
3. For each market, it calls your backend's `/api/settle/:marketId`
4. Your backend:
   - Checks if the Manifold market is resolved
   - Calls `settleMarket` on the smart contract
   - Reads bets from Supabase
   - Updates the leaderboard
   - Marks the market as settled

## Monitoring

Check the Edge Function logs in Supabase Dashboard → Edge Functions → settle-markets → Logs

## Troubleshooting

- **"Connection refused"**: Make sure `BACKEND_URL` is correct and accessible from Supabase
- **"Market cancelled"**: This is expected for cancelled markets, they won't be settled
- **"Supabase error"**: Check your database permissions and RLS policies
- **Cron not running**: Verify pg_cron is enabled and the schedule is correct

## Alternative: Webhook Approach

Instead of polling, you could set up a webhook from Manifold (if available) to directly call your backend when a market resolves. This would be more efficient but requires Manifold to support webhooks.
