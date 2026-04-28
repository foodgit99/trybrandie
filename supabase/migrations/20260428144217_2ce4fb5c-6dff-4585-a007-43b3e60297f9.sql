CREATE TABLE IF NOT EXISTS public.research_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL,
  query_hash text NOT NULL,
  query_preview text,
  result text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (category_id, query_hash)
);

CREATE INDEX IF NOT EXISTS idx_research_cache_lookup
  ON public.research_cache (category_id, query_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_research_cache_expires
  ON public.research_cache (expires_at);

ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only edge functions using the service role can access this.