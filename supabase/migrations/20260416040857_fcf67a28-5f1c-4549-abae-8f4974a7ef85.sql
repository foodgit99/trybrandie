
CREATE TABLE public.credit_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  remaining integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  granted_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credit rewards"
  ON public.credit_rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own rewards"
  ON public.credit_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages rewards"
  ON public.credit_rewards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_credit_rewards_user_active
  ON public.credit_rewards (user_id, expires_at)
  WHERE remaining > 0;
