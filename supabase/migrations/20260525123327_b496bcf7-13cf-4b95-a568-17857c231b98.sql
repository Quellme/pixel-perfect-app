CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own integrations select" ON public.user_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own integrations insert" ON public.user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own integrations update" ON public.user_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own integrations delete" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_integrations_updated_at
BEFORE UPDATE ON public.user_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();