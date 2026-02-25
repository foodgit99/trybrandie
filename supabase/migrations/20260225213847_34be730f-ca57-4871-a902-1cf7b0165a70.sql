ALTER TABLE public.brands ADD COLUMN tone_of_voice text;
ALTER TABLE public.brands ADD COLUMN personality_traits text[] DEFAULT '{}';