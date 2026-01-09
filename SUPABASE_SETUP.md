# Supabase Leaderboard Setup Guide

This guide explains how to set up Supabase for the Dance-to-Beatmatch-Ratio Leaderboard.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created
3. Netlify deployment configured with environment variables

## Step 1: Create the Leaderboard Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL to create the `leaderboard` table:

```sql
-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id BIGSERIAL PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  ratio DECIMAL(5,2) NOT NULL CHECK (ratio >= 0 AND ratio <= 100),
  beatmatches INTEGER NOT NULL CHECK (beatmatches >= 10),
  dance_attempts INTEGER NOT NULL DEFAULT 0,
  perfect_beats INTEGER NOT NULL DEFAULT 0,
  beat_attacks INTEGER NOT NULL DEFAULT 0,
  damage_dealt DECIMAL(10,2) NOT NULL DEFAULT 0,
  air_time_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries (sorted by ratio DESC)
CREATE INDEX IF NOT EXISTS idx_leaderboard_ratio ON leaderboard(ratio DESC, beatmatches DESC, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
```

## Step 2: Configure Row Level Security (RLS) Policies

Since we're using the service role key in Netlify Functions (server-side), we need to allow public read access and controlled insert access.

1. In Supabase Dashboard, go to **Authentication** > **Policies**
2. Select the `leaderboard` table
3. Create the following policies:

### Policy 1: Allow Public Read Access

```sql
-- Policy: Allow anyone to read leaderboard entries
CREATE POLICY "Allow public read access" ON leaderboard
  FOR SELECT
  USING (true);
```

### Policy 2: Allow Public Insert (for Netlify Functions)

```sql
-- Policy: Allow public insert (validated by Netlify Function)
CREATE POLICY "Allow public insert" ON leaderboard
  FOR INSERT
  WITH CHECK (true);
```

**Note**: The Netlify Functions validate the data before insertion, so public insert is safe. The service role key bypasses RLS, but these policies ensure the table is accessible if needed.

## Step 3: Configure Netlify Environment Variables

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Add the following variables:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Finding Your Supabase Credentials

1. **SUPABASE_URL**:

   - Go to Supabase Dashboard > **Settings** > **API**
   - Copy the **Project URL**

2. **SUPABASE_SERVICE_ROLE_KEY**:
   - Go to Supabase Dashboard > **Settings** > **API**
   - Copy the **service_role** key (⚠️ Keep this secret! Never expose in client-side code)

## Step 4: Install Supabase Client in Netlify Functions

The Netlify Functions require the `@supabase/supabase-js` package. Add it to your project:

```bash
npm install @supabase/supabase-js
```

Or if using Netlify CLI, ensure it's in your `package.json`:

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

## Step 5: Test the Setup

1. Deploy your site to Netlify
2. Play a match and achieve at least 10 successful beatmatches
3. Check the scoreboard after the match
4. Verify the score appears in Supabase:
   - Go to Supabase Dashboard > **Table Editor** > `leaderboard`
   - You should see your entry

## Troubleshooting

### Error: "Missing Supabase credentials"

- Verify environment variables are set in Netlify
- Redeploy after adding environment variables

### Error: "Database error" or "relation does not exist"

- Verify the table was created successfully
- Check table name matches exactly: `leaderboard`

### Error: "Minimum 10 successful beatmatches required"

- This is expected behavior - players need at least 10 beatmatches to submit

### Scores not appearing in leaderboard

- Check Netlify Function logs: **Functions** > **leaderboard-submit** > **Logs**
- Verify RLS policies allow public read access
- Check browser console for client-side errors

## Leaderboard Query Examples

### Get Top 10 Scores

```sql
SELECT * FROM leaderboard
ORDER BY ratio DESC, beatmatches DESC, created_at DESC
LIMIT 10;
```

### Get Player's Best Score

```sql
SELECT * FROM leaderboard
WHERE player_name = 'PlayerName'
ORDER BY ratio DESC
LIMIT 1;
```

## Security Notes

- The service role key has full database access - keep it secret
- Netlify Functions validate all input before insertion
- RLS policies provide an additional layer of security
- Consider rate limiting in production to prevent spam
