
-- Drop old single-account uniqueness if present
ALTER TABLE public.user_integrations DROP CONSTRAINT IF EXISTS user_integrations_user_id_provider_key;
DROP INDEX IF EXISTS user_integrations_user_id_provider_key;

-- New uniqueness: one row per (user, provider, account_email)
CREATE UNIQUE INDEX IF NOT EXISTS user_integrations_user_provider_email_uniq
  ON public.user_integrations (user_id, provider, COALESCE(account_email, ''));

-- account_id on email_threads
ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gmail';

-- new uniqueness so the same external id from two accounts coexists
ALTER TABLE public.email_threads DROP CONSTRAINT IF EXISTS email_threads_user_id_gmail_thread_id_key;
DROP INDEX IF EXISTS email_threads_user_id_gmail_thread_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS email_threads_user_account_thread_uniq
  ON public.email_threads (user_id, COALESCE(account_id::text, ''), gmail_thread_id);

-- account_id on calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.user_integrations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS calendar_events_account_idx ON public.calendar_events (account_id);
CREATE INDEX IF NOT EXISTS email_threads_account_idx ON public.email_threads (account_id);
