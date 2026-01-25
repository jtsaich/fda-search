-- Migration: Add token usage columns to messages table
-- Run this in Supabase SQL Editor

-- Add token usage columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

-- Add an index for querying token usage (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_messages_tokens ON messages (chat_id, prompt_tokens, completion_tokens);

-- Comment on columns
COMMENT ON COLUMN messages.prompt_tokens IS 'Number of input tokens used for this message';
COMMENT ON COLUMN messages.completion_tokens IS 'Number of output tokens generated for this message';
COMMENT ON COLUMN messages.total_tokens IS 'Total tokens (prompt + completion) for this message';
