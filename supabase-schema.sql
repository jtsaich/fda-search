-- Chat persistence tables for FDA RAG Assistant
-- Run this in your Supabase SQL editor

-- Table to store chat sessions
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title TEXT,
    -- Add user_id if you implement authentication later
    -- user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table to store messages within chat sessions
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content JSONB NOT NULL, -- Store the full message structure (parts, metadata, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number INTEGER NOT NULL,
    CONSTRAINT messages_chat_sequence UNIQUE (chat_id, sequence_number)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on chats
DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) if you add authentication later
-- ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment when you add authentication)
-- CREATE POLICY "Users can view their own chats" ON chats
--     FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert their own chats" ON chats
--     FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update their own chats" ON chats
--     FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete their own chats" ON chats
--     FOR DELETE USING (auth.uid() = user_id);
