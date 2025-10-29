# Quick Start Guide - Chat Persistence

## 🚀 Quick Setup (5 minutes)

### 1. Create Supabase Project
```bash
1. Visit https://supabase.com
2. Click "New Project"
3. Note your Project URL and anon key
```

### 2. Setup Database
```bash
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of supabase-schema.sql
3. Click "Run" to create tables
```

### 3. Configure Environment
```bash
# In frontend/.env.local (create if doesn't exist)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Install & Run
```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend
cd frontend
npm install  # Only needed once
npm run dev
```

### 5. Test It Out
```bash
1. Visit http://localhost:3000
2. Auto-redirects to /chat/[new-uuid]
3. Send a message
4. Refresh page - messages persist!
```

## ✅ How to Verify It's Working

### Check Frontend
- URL should be `/chat/[uuid]` format
- Refresh page → messages still there
- Check browser console → "Chat saved successfully"

### Check Database
```sql
-- In Supabase SQL Editor
SELECT * FROM chats ORDER BY updated_at DESC;
SELECT * FROM messages WHERE chat_id = 'your-chat-id';
```

## 🔧 Troubleshooting

### "Missing Supabase environment variables"
```bash
# Make sure file is named .env.local (not .env)
# Must be in frontend/ directory
# Variables must start with NEXT_PUBLIC_
# Restart dev server after adding
```

### Messages not saving
```bash
# Check browser console for errors
# Verify Supabase credentials
# Check Supabase dashboard → Database → Logs
```

### Can't connect to Supabase
```bash
# Verify project URL is correct
# Check anon key is complete (very long string)
# Ensure project is not paused
```

## 📁 Key Files

```
supabase-schema.sql          # Run this in Supabase SQL Editor
frontend/lib/supabase.ts     # Connection config
frontend/lib/chat-store.ts   # Database operations
frontend/app/page.tsx        # Creates new chat
frontend/app/chat/[id]/      # Loads existing chat
```

## 🎯 What Changed

**Before**: Chat cleared on refresh
**After**: Full conversation history persisted

**User Experience**:
1. Visit site → new chat created automatically
2. Send messages → saved to Supabase
3. Refresh/close/reopen → history preserved
4. Each chat has unique URL you can bookmark

## 📚 More Info

- Full setup guide: `CHAT_PERSISTENCE_SETUP.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Supabase docs: https://supabase.com/docs
