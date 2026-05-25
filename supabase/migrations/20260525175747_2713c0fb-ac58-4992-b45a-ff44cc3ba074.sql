
-- Trial feedback table
CREATE TABLE public.trial_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nps_score INTEGER NOT NULL,
  what_worked TEXT,
  what_didnt TEXT,
  contact_name TEXT,
  contact_email TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback select" ON public.trial_feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.trial_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- NPS range validation via trigger (not CHECK, per guidelines)
CREATE OR REPLACE FUNCTION public.validate_trial_feedback()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nps_score < 0 OR NEW.nps_score > 10 THEN
    RAISE EXCEPTION 'nps_score must be between 0 and 10';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trial_feedback_validate
  BEFORE INSERT OR UPDATE ON public.trial_feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_trial_feedback();

-- Profiles: add referral + terms + GDPR fields
ALTER TABLE public.profiles
  ADD COLUMN ref_code TEXT UNIQUE,
  ADD COLUMN referred_by TEXT,
  ADD COLUMN referral_converted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN deletion_requested_at TIMESTAMPTZ;

-- Generate short unique ref_code
CREATE OR REPLACE FUNCTION public.generate_ref_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    PERFORM 1 FROM public.profiles WHERE ref_code = code;
    IF NOT FOUND THEN done := true; END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- Update handle_new_user to also stamp ref_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, ref_code, referred_by, terms_accepted_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.generate_ref_code(),
    NULLIF(NEW.raw_user_meta_data->>'referred_by', ''),
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted')::boolean THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill ref_code for existing profiles
UPDATE public.profiles SET ref_code = public.generate_ref_code() WHERE ref_code IS NULL;
