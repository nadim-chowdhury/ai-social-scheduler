-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  ai_credits_used integer DEFAULT 0,
  ai_credits_limit integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workspace members table
CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','editor','viewer')) DEFAULT 'editor',
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Social accounts table
CREATE TABLE social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok')),
  platform_user_id text NOT NULL,
  platform_username text,
  name text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(workspace_id, platform, platform_user_id)
);

-- Posts table
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id),
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok')),
  social_account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
  content_text text,
  media_urls text[],
  scheduled_at timestamptz,
  timezone text DEFAULT 'UTC',
  status text CHECK (status IN ('draft','scheduled','posting','posted','failed')) DEFAULT 'draft',
  platform_post_id text, -- ID returned by social platform
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  posted_at timestamptz
);

-- Analytics table
CREATE TABLE analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  comments bigint DEFAULT 0,
  shares bigint DEFAULT 0,
  saves bigint DEFAULT 0,
  engagement_rate numeric(5,2) DEFAULT 0,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- AI requests table (for billing and auditing)
CREATE TABLE ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('text', 'image', 'video')),
  provider text NOT NULL,
  cost numeric(10,4) DEFAULT 0,
  prompt text NOT NULL,
  response jsonb,
  status text CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Billing subscriptions table
CREATE TABLE billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')) DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI templates table
CREATE TABLE ai_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL,
  template_type text CHECK (template_type IN ('caption', 'hashtags', 'cta', 'full_post')),
  content text NOT NULL,
  variables jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_social_accounts_workspace_id ON social_accounts(workspace_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX idx_posts_workspace_id ON posts(workspace_id);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_analytics_post_id ON analytics(post_id);
CREATE INDEX idx_ai_requests_workspace_id ON ai_requests(workspace_id);
CREATE INDEX idx_ai_requests_created_at ON ai_requests(created_at);
CREATE INDEX idx_billing_subscriptions_workspace_id ON billing_subscriptions(workspace_id);
CREATE INDEX idx_ai_templates_workspace_id ON ai_templates(workspace_id);

-- Row Level Security (RLS) policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workspaces" ON workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owners can update their workspaces" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Users can view workspace members of their workspaces" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE owner_id = auth.uid() OR id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Workspace owners can manage members" ON workspace_members
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Social accounts policies
CREATE POLICY "Users can view social accounts of their workspaces" ON social_accounts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage social accounts of their workspaces" ON social_accounts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Posts policies
CREATE POLICY "Users can view posts of their workspaces" ON posts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage posts of their workspaces" ON posts
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Analytics policies
CREATE POLICY "Users can view analytics of their workspace posts" ON analytics
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM posts WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- AI requests policies
CREATE POLICY "Users can view their AI requests" ON ai_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create AI requests" ON ai_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Billing subscriptions policies
CREATE POLICY "Users can view billing of their workspaces" ON billing_subscriptions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- AI templates policies
CREATE POLICY "Users can view templates of their workspaces" ON ai_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage templates of their workspaces" ON ai_templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_subscriptions_updated_at BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_templates_updated_at BEFORE UPDATE ON ai_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
