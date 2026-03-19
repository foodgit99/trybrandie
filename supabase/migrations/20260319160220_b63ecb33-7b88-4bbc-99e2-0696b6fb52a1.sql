
-- Strategy conversations table
CREATE TABLE public.strategy_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strategy conversations"
  ON public.strategy_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategy conversations"
  ON public.strategy_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategy conversations"
  ON public.strategy_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategy conversations"
  ON public.strategy_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Strategy messages table
CREATE TABLE public.strategy_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.strategy_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strategy messages"
  ON public.strategy_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategy messages"
  ON public.strategy_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategy messages"
  ON public.strategy_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
