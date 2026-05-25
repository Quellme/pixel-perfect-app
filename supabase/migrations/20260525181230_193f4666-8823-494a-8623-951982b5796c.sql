
DO $$ BEGIN
  CREATE TYPE public.account_category AS ENUM ('work','personal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS category public.account_category NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS label text;
