# Sidebar Auto-Refresh Implementation

## Problem
When creating a new chat or sending messages, the sidebar didn't update to show the new chat or updated timestamps.

## Solution
Implemented multiple refresh triggers:

### 1. URL Change Detection
```typescript
// In ChatSidebar.tsx
useEffect(() => {
  if (currentChatId) {
    // Small delay to ensure database has been written
    const timer = setTimeout(() => {
      loadChats();
    }, 300);
    return () => clearTimeout(timer);
  }
}, [currentChatId]);
```

**Triggers when:**
- New chat is created (URL changes to `/chat/[new-id]`)
- User switches between chats

**Why the delay:**
- Ensures the database write completes before fetching
- 300ms is enough for most database operations
- Prevents race conditions

### 2. Custom Event System
```typescript
// In ChatSidebar.tsx - Listen for events
window.addEventListener('chatUpdated', handleChatUpdate);

// In ChatInterface.tsx - Dispatch after save
window.dispatchEvent(new CustomEvent('chatUpdated'));
```

**Triggers when:**
- A message is sent and saved successfully
- Chat metadata is updated (e.g., updated_at timestamp)

**Benefits:**
- Immediate refresh (no delay needed)
- Decoupled components
- Can be triggered from anywhere in the app

### 3. Initial Mount
```typescript
useEffect(() => {
  loadChats();
  // ... event listener setup
}, []);
```

**Triggers when:**
- Page first loads
- Sidebar component mounts

## How It Works

### Scenario 1: Creating New Chat
```
User clicks "New Chat"
  → /chat/page.tsx calls createChat()
  → New chat created in Supabase
  → Redirect to /chat/[new-id]
  → currentChatId changes
  → useEffect triggers with 300ms delay
  → Sidebar refreshes, shows new chat
```

### Scenario 2: Sending Message
```
User sends message
  → AI responds
  → onFinish callback triggered
  → Messages saved to Supabase
  → window.dispatchEvent('chatUpdated')
  → Sidebar event listener fires
  → Sidebar refreshes immediately
  → Updated timestamp shown
```

### Scenario 3: Switching Chats
```
User clicks different chat in sidebar
  → Navigate to /chat/[different-id]
  → currentChatId changes
  → useEffect triggers with 300ms delay
  → Sidebar refreshes
  → New chat highlighted as active
```

## Files Modified

### `frontend/components/ChatSidebar.tsx`
**Added:**
- Event listener for `chatUpdated` event
- URL change detection with delayed refresh
- Cleanup for event listeners

**Changes:**
```typescript
useEffect(() => {
  loadChats();

  // Listen for custom events
  const handleChatUpdate = () => {
    console.log('Chat update event received, refreshing sidebar');
    loadChats();
  };

  window.addEventListener('chatUpdated', handleChatUpdate);
  return () => window.removeEventListener('chatUpdated', handleChatUpdate);
}, []);

// Also added URL-based refresh
useEffect(() => {
  if (currentChatId) {
    const timer = setTimeout(() => loadChats(), 300);
    return () => clearTimeout(timer);
  }
}, [currentChatId]);
```

### `frontend/components/ChatInterface.tsx`
**Added:**
- Event dispatch after successful save

**Changes:**
```typescript
onFinish: async (options) => {
  // ... save logic ...
  await saveChat({ chatId: id, messages: options.messages });
  console.log("Chat saved successfully");

  // NEW: Notify sidebar to refresh
  window.dispatchEvent(new CustomEvent('chatUpdated'));
}
```

## Testing

### Test 1: New Chat Creation
1. Click "New Chat" button
2. Wait 300ms
3. ✅ New chat should appear in sidebar

### Test 2: Send Message
1. Send a message in active chat
2. Wait for AI response
3. ✅ Sidebar timestamp should update immediately

### Test 3: Switch Chats
1. Click a different chat in sidebar
2. Wait 300ms
3. ✅ Sidebar should highlight new active chat

### Test 4: Delete Chat
1. Hover over chat
2. Click delete button
3. ✅ Chat removed from list immediately (no refresh needed)

## Performance Considerations

### Debouncing
The 300ms delay serves as a debounce, preventing:
- Excessive database queries
- Race conditions
- UI flickering

### Event Cleanup
Event listeners are properly cleaned up to prevent:
- Memory leaks
- Multiple event handlers
- Stale closures

### Selective Refresh
Only refreshes when:
- Actually needed (URL change, message sent)
- Not on every render
- Not on unrelated state changes

## Future Enhancements

### Real-time Updates with Supabase
```typescript
// Subscribe to database changes
const subscription = supabase
  .channel('chats')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'chats' },
    (payload) => loadChats()
  )
  .subscribe();
```

**Benefits:**
- No delay needed
- Multi-tab synchronization
- Real-time collaboration

### Optimistic Updates
```typescript
// Update UI immediately, sync later
function handleSendMessage() {
  // Add message to UI
  setChats(prev => updateTimestamp(prev, chatId));

  // Save to database (background)
  saveChat(...);
}
```

**Benefits:**
- Instant UI feedback
- Better perceived performance
- Smoother UX

### Cache Layer
```typescript
// Cache chat list in memory
const chatCache = new Map<string, Chat[]>();

function loadChats() {
  // Return cached if recent
  if (chatCache.has('list') && isRecent(chatCache.get('list'))) {
    return chatCache.get('list');
  }

  // Otherwise fetch from database
  const chats = await listChats();
  chatCache.set('list', chats);
  return chats;
}
```

**Benefits:**
- Reduced database queries
- Faster UI updates
- Lower costs

## Troubleshooting

### Sidebar not updating
1. Check browser console for errors
2. Verify `chatUpdated` event is firing
3. Check network tab for database requests
4. Ensure Supabase connection is working

### Delay too long
```typescript
// Reduce delay (if database is fast)
setTimeout(() => loadChats(), 100); // 100ms instead of 300ms
```

### Multiple refreshes
```typescript
// Add debounce to loadChats
const debouncedLoadChats = debounce(loadChats, 300);
```

## Summary

The sidebar now automatically refreshes in all necessary scenarios:
- ✅ New chat creation
- ✅ Message sent/received
- ✅ Chat switching
- ✅ Initial page load

Uses a combination of:
- React hooks for URL detection
- Custom events for cross-component communication
- Delays to prevent race conditions
- Proper cleanup to prevent memory leaks
