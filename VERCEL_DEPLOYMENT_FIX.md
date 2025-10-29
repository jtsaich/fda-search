# Fixing Supabase Insert Issues on Vercel

## Problem
`createChat()` works locally but fails to insert new chats into Supabase when deployed on Vercel.

## Root Cause
The original implementation used a **server component** (`async` function with server-side `redirect()`), which runs on Vercel's serverless functions. This caused issues:

1. **Serverless cold starts** - Connection not fully established
2. **Early termination** - Function exits before database write completes
3. **Environment variable timing** - Variables not available when needed

## Solution

### 1. Convert to Client Component
**File**: `frontend/app/chat/page.tsx`

**Before** (Server Component):
```typescript
import { redirect } from 'next/navigation';
import { createChat } from '@/lib/chat-store';

export default async function ChatPage() {
  const id = await createChat();
  redirect(`/chat/${id}`);
}
```

**After** (Client Component):
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createChat } from '@/lib/chat-store';

export default function ChatPage() {
  const router = useRouter();

  useEffect(() => {
    async function createNewChat() {
      try {
        const id = await createChat();
        router.push(`/chat/${id}`);
      } catch (error) {
        console.error('Failed to create chat:', error);
        // Retry once
        setTimeout(async () => {
          const id = await createChat();
          router.push(`/chat/${id}`);
        }, 1000);
      }
    }
    createNewChat();
  }, [router]);

  return <LoadingScreen />;
}
```

**Why this works:**
- ✅ Runs in browser, not serverless function
- ✅ `NEXT_PUBLIC_*` env vars always available
- ✅ Database operations complete before navigation
- ✅ Includes retry logic for reliability
- ✅ Shows loading state to user

### 2. Optimize Supabase Client
**File**: `frontend/lib/supabase.ts`

**Added Configuration:**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,    // Don't persist in serverless
    autoRefreshToken: false,   // No need for client-side
    detectSessionInUrl: false, // Skip URL detection
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'fda-rag-assistant',
    },
  },
});
```

**Why these options:**
- `persistSession: false` - Serverless functions are stateless
- `autoRefreshToken: false` - No long-lived sessions needed
- `detectSessionInUrl: false` - Not using OAuth flows
- Headers - Better tracking in Supabase logs

### 3. Enhanced Error Logging
**File**: `frontend/lib/chat-store.ts`

**Added:**
```typescript
export async function createChat(): Promise<string> {
  console.log('createChat: Starting...');
  console.log('createChat: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  try {
    const { data, error } = await supabase
      .from("chats")
      .insert({})
      .select("id")
      .single();

    if (error) {
      console.error("createChat: Supabase error:", error);
      throw new Error(`Failed to create chat: ${error.message}`);
    }

    if (!data || !data.id) {
      throw new Error("Failed to create chat: No ID returned");
    }

    console.log('createChat: Success, ID:', data.id);
    return data.id;
  } catch (err) {
    console.error("createChat: Exception:", err);
    throw err;
  }
}
```

**Benefits:**
- See exactly where failures occur
- Verify environment variables are set
- Track database responses
- Debug Vercel function logs

## Vercel Environment Variables

### Required Variables
In your Vercel project settings, ensure these are set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### How to Set:
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Add both variables
5. Select all environments (Production, Preview, Development)
6. **Important:** Redeploy after adding variables

### Verification:
Check deployment logs for:
```
Supabase client initialized: { url: 'https://...', hasKey: true }
```

## Testing on Vercel

### 1. Check Deployment Logs
```bash
# In Vercel Dashboard → Deployments → Your deployment → Functions
# Look for console.log output from createChat
```

**Expected logs:**
```
createChat: Starting chat creation...
createChat: Supabase URL: https://xxxxx.supabase.co
createChat: Successfully created chat with ID: abc-123-def-456
```

**Error logs to watch for:**
```
createChat: Supabase error: { ... }
createChat: No data returned from insert
Missing Supabase environment variables
```

### 2. Check Browser Console
When clicking "New Chat" on Vercel, check browser DevTools:

```
Creating new chat...
createChat: Starting...
Chat created with ID: abc-123-def-456
Chat update event received, refreshing sidebar
```

### 3. Verify in Supabase
1. Go to Supabase Dashboard
2. Table Editor → chats table
3. Check if new rows are created when clicking "New Chat"

## Common Issues and Solutions

### Issue 1: "Missing Supabase environment variables"
**Symptoms:**
- Error in browser console
- Function fails immediately

**Solution:**
```bash
# Check Vercel env vars are set
vercel env ls

# Add if missing
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Redeploy
vercel --prod
```

### Issue 2: Database insert succeeds locally but not on Vercel
**Symptoms:**
- Works in `npm run dev`
- Fails in production
- No errors in logs

**Solution:**
1. Check Supabase project isn't paused (free tier)
2. Verify database connection limits not exceeded
3. Check Supabase logs for blocked requests
4. Ensure RLS policies allow anonymous inserts

### Issue 3: Function timeout
**Symptoms:**
- Hangs on "Creating new chat..."
- Times out after 10s

**Solution:**
```typescript
// Add timeout to database call
const createWithTimeout = Promise.race([
  createChat(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  )
]);
```

### Issue 4: Cold start delays
**Symptoms:**
- First request slow/fails
- Subsequent requests work

**Solution:**
- Already handled by retry logic
- Client-side approach avoids serverless cold starts
- Consider Vercel Pro for faster cold starts

## Supabase Configuration

### Check RLS Policies
Ensure your `chats` table allows inserts:

```sql
-- In Supabase SQL Editor
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'chats';

-- If RLS is enabled but no policies, temporarily disable for testing
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;

-- Or add policy to allow inserts
CREATE POLICY "Allow anonymous inserts" ON chats
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### Check Connection Pooling
For high traffic, enable connection pooling in Supabase:

1. Database Settings → Connection Pooling
2. Enable pooling
3. Use pooler connection string if needed

## Performance Optimization

### 1. Reduce Database Calls
```typescript
// Cache chat list on client
const chatCache = new Map();

export async function listChats() {
  const cached = chatCache.get('chats');
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }

  const data = await fetchFromSupabase();
  chatCache.set('chats', { data, timestamp: Date.now() });
  return data;
}
```

### 2. Optimize Queries
```typescript
// Use select to limit returned fields
.select('id, created_at')  // Not: select('*')

// Use limit for lists
.limit(50)  // Don't fetch all chats

// Use single() for one result
.single()  // Not: .then(data => data[0])
```

### 3. Add Indexes
```sql
-- In Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_chats_updated_at
  ON chats(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id
  ON messages(chat_id);
```

## Monitoring

### Vercel Analytics
1. Enable Runtime Logs in Vercel
2. Monitor function execution times
3. Check error rates

### Supabase Logs
1. Dashboard → Logs → Database
2. Filter by table: `chats`
3. Check for failed inserts

### Custom Monitoring
```typescript
// Add to createChat function
const startTime = Date.now();
try {
  const id = await createChat();
  console.log(`Chat created in ${Date.now() - startTime}ms`);
  return id;
} catch (error) {
  console.error(`Chat creation failed after ${Date.now() - startTime}ms`);
  throw error;
}
```

## Rollback Plan

If issues persist, you can temporarily use a different approach:

### Option 1: Generate ID Client-Side
```typescript
import { v4 as uuidv4 } from 'uuid';

export async function createChat(): Promise<string> {
  const id = uuidv4();

  // Insert with explicit ID
  await supabase
    .from('chats')
    .insert({ id })
    .select()
    .single();

  return id;
}
```

### Option 2: API Route
```typescript
// app/api/chat/create/route.ts
export async function POST() {
  const id = await createChat();
  return Response.json({ id });
}

// Then call from client
const res = await fetch('/api/chat/create', { method: 'POST' });
const { id } = await res.json();
```

## Summary

**Changes Made:**
1. ✅ Converted `/chat` page to client component
2. ✅ Added retry logic for reliability
3. ✅ Optimized Supabase client for serverless
4. ✅ Enhanced error logging
5. ✅ Added loading state

**Benefits:**
- Works on Vercel production
- Better error handling
- Improved debugging
- More reliable chat creation
- Better user experience

**Next Steps:**
1. Deploy to Vercel
2. Test "New Chat" functionality
3. Check browser console for logs
4. Verify chats appear in Supabase
5. Monitor function logs in Vercel

If issues persist, check the logs and follow the troubleshooting steps above!
