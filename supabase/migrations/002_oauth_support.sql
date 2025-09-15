-- OAuth attempts table for secure OAuth flow management
CREATE TABLE oauth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok')),
  state text NOT NULL UNIQUE,
  code_verifier text, -- For PKCE (Twitter)
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_oauth_attempts_state ON oauth_attempts(state);
CREATE INDEX idx_oauth_attempts_workspace_user ON oauth_attempts(workspace_id, user_id);
CREATE INDEX idx_oauth_attempts_expires_at ON oauth_attempts(expires_at);

-- Add columns to social_accounts for better token management
ALTER TABLE social_accounts 
ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

-- Update platform check to include youtube
ALTER TABLE social_accounts 
DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

ALTER TABLE social_accounts 
ADD CONSTRAINT social_accounts_platform_check 
CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'));

-- Update posts platform check to include youtube
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_platform_check;

ALTER TABLE posts 
ADD CONSTRAINT posts_platform_check 
CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'));

-- Add RLS policies for oauth_attempts
ALTER TABLE oauth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OAuth attempts" ON oauth_attempts
  FOR ALL USING (user_id = auth.uid());

-- Function to clean up expired OAuth attempts
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_attempts WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired attempts (if pg_cron is available)
-- SELECT cron.schedule('cleanup-oauth-attempts', '*/5 * * * *', 'SELECT cleanup_expired_oauth_attempts();');
