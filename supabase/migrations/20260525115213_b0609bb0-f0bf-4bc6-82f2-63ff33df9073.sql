-- Utility: updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enums
CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.task_energy AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.task_status AS ENUM ('todo', 'done', 'snoozed');
CREATE TYPE public.task_source AS ENUM ('manual', 'gmail', 'calendar', 'agent');
CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'system');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  gmail_connected BOOLEAN NOT NULL DEFAULT false,
  calendar_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  energy public.task_energy NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'todo',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source public.task_source NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tasks insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tasks update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own tasks delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX tasks_user_status_idx ON public.tasks(user_id, status);
CREATE INDEX tasks_user_due_idx ON public.tasks(user_id, due_at);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notes
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes select" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notes insert" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes update" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own notes delete" ON public.notes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX notes_user_idx ON public.notes(user_id, updated_at DESC);
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- calendar_events
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'google',
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events select" ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own events insert" ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own events update" ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own events delete" ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX events_user_start_idx ON public.calendar_events(user_id, starts_at);
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- email_threads
CREATE TABLE public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  from_address TEXT,
  importance_score INTEGER NOT NULL DEFAULT 0,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, gmail_thread_id)
);
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads select" ON public.email_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own threads insert" ON public.email_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own threads update" ON public.email_threads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own threads delete" ON public.email_threads FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX threads_user_received_idx ON public.email_threads(user_id, received_at DESC);
CREATE TRIGGER threads_updated_at BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_messages
CREATE TABLE public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  content TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.agent_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.agent_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.agent_messages FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX messages_user_created_idx ON public.agent_messages(user_id, created_at DESC);

-- daily_briefings
CREATE TABLE public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  summary TEXT NOT NULL,
  highlights JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, briefing_date)
);
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own briefings select" ON public.daily_briefings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own briefings insert" ON public.daily_briefings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own briefings update" ON public.daily_briefings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own briefings delete" ON public.daily_briefings FOR DELETE USING (auth.uid() = user_id);
