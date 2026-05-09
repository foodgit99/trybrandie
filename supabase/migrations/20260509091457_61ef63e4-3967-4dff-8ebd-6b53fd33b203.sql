CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'credited',
  credited_via text NOT NULL,
  credited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_event jsonb
);

CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment transactions"
  ON public.payment_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payment transactions"
  ON public.payment_transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages payment transactions"
  ON public.payment_transactions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);