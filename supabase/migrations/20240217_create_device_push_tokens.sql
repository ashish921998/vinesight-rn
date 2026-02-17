-- Migration: Create device_push_tokens table for Expo push notifications
-- Run this migration using: supabase db push or supabase migrations new

-- Create the device_push_tokens table
CREATE TABLE IF NOT EXISTS device_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  device_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by user_id
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON device_push_tokens(user_id);

-- Index for quick lookups by expo_push_token
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_expo_token ON device_push_tokens(expo_push_token);

-- Enable Row Level Security
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own device tokens
CREATE POLICY "Users can manage their own device tokens"
  ON device_push_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Create or replace a function to handle task assignment notifications
-- This will be called by the edge function
CREATE OR REPLACE FUNCTION get_user_push_tokens(target_user_id UUID)
RETURNS TABLE(
  id BIGINT,
  expo_push_token TEXT,
  device_name TEXT,
  platform TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dpt.id,
    dpt.expo_push_token,
    dpt.device_name,
    dpt.platform
  FROM device_push_tokens dpt
  WHERE dpt.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
