
DO $$ BEGIN
  CREATE TYPE public.email_category AS ENUM ('action','aware','delivery','promo','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS category public.email_category;
