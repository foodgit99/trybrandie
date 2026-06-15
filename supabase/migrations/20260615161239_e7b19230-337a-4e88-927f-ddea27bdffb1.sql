
-- agent_settings: per (user, brand) configuration
CREATE TABLE public.agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  autonomy_enabled boolean NOT NULL DEFAULT false,
  tool_modes jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_tool_ceiling integer NOT NULL DEFAULT 50,
  daily_spend_ceiling integer NOT NULL DEFAULT 10,
  persona_notes text,
  forbidden_topics text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, brand_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent_settings" ON public.agent_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_conversations
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web',
  title text,
  external_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_conversations TO authenticated;
GRANT ALL ON public.agent_conversations TO service_role;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent_conversations" ON public.agent_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_conversations_user ON public.agent_conversations(user_id, last_message_at DESC);

-- agent_messages
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent_messages" ON public.agent_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_messages_conv ON public.agent_messages(conversation_id, created_at);

-- agent_actions: audit log
CREATE TABLE public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.agent_conversations(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  mode text NOT NULL DEFAULT 'auto',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  status text NOT NULL DEFAULT 'completed',
  is_reversible boolean NOT NULL DEFAULT false,
  reverse_payload jsonb,
  spend_units integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_actions TO authenticated;
GRANT ALL ON public.agent_actions TO service_role;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own agent_actions" ON public.agent_actions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own agent_actions" ON public.agent_actions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_agent_actions_user_day ON public.agent_actions(user_id, created_at DESC);

-- agent_api_tokens: external endpoint auth
CREATE TABLE public.agent_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'API Token',
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_api_tokens TO authenticated;
GRANT ALL ON public.agent_api_tokens TO service_role;
ALTER TABLE public.agent_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent_api_tokens" ON public.agent_api_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_agent_api_tokens_user ON public.agent_api_tokens(user_id) WHERE revoked_at IS NULL;
