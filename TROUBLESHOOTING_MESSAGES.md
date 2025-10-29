# Troubleshooting: Messages Not Loading After Refresh

## Problem
Messages are saved to Supabase database but don't load when refreshing the page.

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Refresh the page
4. Look for these log messages:

```
Loading chat with ID: [uuid]
Raw data from Supabase: [...]
Number of messages loaded: X
Parsed messages: [...]
```

**What to look for:**
- Is the correct chat ID being used?
- Is data being returned from Supabase?
- Are messages being parsed correctly?

### Step 2: Verify Data in Supabase
1. Go to your Supabase project dashboard
2. Navigate to Table Editor
3. Check the `messages` table:

```sql
SELECT * FROM messages WHERE chat_id = 'your-chat-id-here' ORDER BY sequence_number;
```

**Check:**
- Do messages exist for this chat_id?
- Is the `content` column populated (should be JSONB)?
- Are `sequence_number` values correct (0, 1, 2, ...)?

### Step 3: Check Environment Variables
Verify your `.env.local` file in the `frontend/` directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**Test connection:**
```typescript
// In browser console on your site
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Should output your URL, not undefined
```

### Step 4: Check Save Operation
After sending a message, check console for:

```
Saving chat: [uuid]
Number of messages to save: X
Messages to save: [array]
Prepared messages for insert: X
Successfully saved messages: X
```

**If you see errors:**
- "Failed to save messages" → Check Supabase permissions
- "Chat saved successfully" → Messages were saved correctly

### Step 5: Verify Message Structure
In browser console when messages load, check structure:

```javascript
// Each message should have:
{
  id: "msg_xxx",
  role: "user" | "assistant",
  content: "...",
  parts: [...],
  createdAt: Date,
  // ... other fields
}
```

## Common Issues and Solutions

### Issue 1: Empty Array Returned
**Symptom:** Console shows `Number of messages loaded: 0`

**Possible causes:**
1. **Wrong chat_id**: URL doesn't match database
   - Check URL: `/chat/[uuid]`
   - Check database: `SELECT DISTINCT chat_id FROM messages`

2. **Messages not saved**: Check save logs
   - Should see "Successfully saved messages: X"

3. **RLS Policies blocking**: Supabase RLS enabled
   - Go to Supabase → Authentication → Policies
   - Temporarily disable RLS on `messages` table for testing

**Solution:**
```sql
-- In Supabase SQL Editor
-- Check if messages exist
SELECT chat_id, COUNT(*) FROM messages GROUP BY chat_id;

-- Check specific chat
SELECT * FROM messages WHERE chat_id = 'your-uuid-here';
```

### Issue 2: Supabase Connection Error
**Symptom:** Console shows `Error loading chat: ...`

**Possible causes:**
1. Invalid Supabase credentials
2. Project paused or deleted
3. Network issues

**Solution:**
```typescript
// Test connection in browser console
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'YOUR_URL',
  'YOUR_KEY'
);

const { data, error } = await supabase.from('chats').select('*').limit(1);
console.log(data, error);
```

### Issue 3: Wrong Initial Messages Prop
**Symptom:** Messages exist but don't show in UI

**Check:** `ChatInterface` component receiving correct props

```typescript
// In app/chat/[id]/page.tsx
console.log('Initial messages:', initialMessages);
console.log('Number of initial messages:', initialMessages.length);
```

**Verify:**
- `initialMessages` is not `undefined`
- `initialMessages` is an array
- `id` prop matches URL parameter

### Issue 4: useChat Hook Not Using Initial Messages
**Symptom:** `useChat` hook ignores `initialMessages`

**Check:** Make sure it's `initialMessages` not `messages`:

```typescript
// Correct ✓
const { messages, sendMessage } = useChat({
  id,
  initialMessages, // ← This is correct
  // ...
});

// Wrong ✗
const { messages, sendMessage } = useChat({
  id,
  messages: initialMessages, // ← Wrong prop name
  // ...
});
```

### Issue 5: Messages Saved with Wrong Structure
**Symptom:** Data exists but can't be parsed

**Check database structure:**
```sql
SELECT
  id,
  chat_id,
  role,
  content,
  sequence_number
FROM messages
LIMIT 1;
```

**Verify `content` column:**
- Should be JSONB type
- Should contain full UIMessage object
- Should have `id`, `role`, `parts`, etc.

**Example correct content:**
```json
{
  "id": "msg_123",
  "role": "user",
  "content": "Hello",
  "parts": [{"type": "text", "text": "Hello"}],
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

## Quick Diagnostic Script

Run this in your browser console while on the chat page:

```javascript
// Get current chat ID from URL
const chatId = window.location.pathname.split('/').pop();
console.log('Chat ID:', chatId);

// Try to load from Supabase directly
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('chat_id', chatId)
  .order('sequence_number');

console.log('Messages from DB:', data);
console.log('Error:', error);
console.log('Count:', data?.length || 0);
```

## Still Not Working?

### Check Next.js Console (Terminal)
Sometimes errors appear in the Next.js server console, not browser:

```bash
cd frontend
npm run dev
# Watch for errors when page loads
```

### Clear Browser Cache
```bash
# Hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Or clear cache manually
DevTools → Application → Clear Storage → Clear site data
```

### Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Then restart
cd frontend
npm run dev
```

### Check for TypeScript Errors
```bash
cd frontend
npm run build
# Check for any compilation errors
```

## Working Example Logs

When everything works correctly, you should see:

```
1. On page load:
   Loading chat with ID: abc-123-def-456
   Raw data from Supabase: [{content: {...}}, {content: {...}}]
   Number of messages loaded: 2
   Parsed messages: [{id: "msg_1", ...}, {id: "msg_2", ...}]

2. After sending message:
   finish {messages: Array(3), responseMessage: {...}}
   Saving chat: abc-123-def-456
   Number of messages to save: 3
   Messages to save: [...]
   Prepared messages for insert: 3
   Successfully saved messages: 3
   Chat saved successfully

3. After refresh:
   Loading chat with ID: abc-123-def-456
   Raw data from Supabase: [{content: {...}}, {content: {...}}, {content: {...}}]
   Number of messages loaded: 3
   Parsed messages: [...]
```

## Get Help

If still stuck after trying everything:

1. **Copy full error messages** from console
2. **Check Supabase logs**: Dashboard → Logs → Error logs
3. **Export database row**: Copy one message row from Supabase
4. **Check Network tab**: Look for failed API calls
5. **Share console output**: All logs from loading and saving

## Prevention

To avoid this issue in future:

1. Always check console after sending messages
2. Verify "Chat saved successfully" appears
3. Test refresh immediately after first message
4. Monitor Supabase usage/quota limits
5. Keep Supabase project active (free tier pauses after inactivity)
