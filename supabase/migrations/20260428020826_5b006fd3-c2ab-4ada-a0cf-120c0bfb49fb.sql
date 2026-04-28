-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- timestamp trigger function (shared)
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

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- trips
-- ============================================================
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  cover_image TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX trips_owner_idx ON public.trips(owner_id);
CREATE INDEX trips_public_idx ON public.trips(is_public) WHERE is_public = true;
CREATE UNIQUE INDEX trips_owner_client_idx
  ON public.trips(owner_id, client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- trip_collaborators
-- ============================================================
CREATE TABLE public.trip_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

CREATE INDEX trip_collaborators_user_idx ON public.trip_collaborators(user_id);
CREATE INDEX trip_collaborators_trip_idx ON public.trip_collaborators(trip_id);

ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- security definer helpers (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_trip_owner(_trip_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = _trip_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_collaborator(_trip_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = _trip_id AND user_id = _user_id
  );
$$;

-- ============================================================
-- trips policies
-- ============================================================
CREATE POLICY "Owner can view their trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view shared trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (public.is_trip_collaborator(id, auth.uid()));

CREATE POLICY "Anyone can view public trips"
  ON public.trips FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

CREATE POLICY "Owner can insert their trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update their trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can update shared trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (public.is_trip_collaborator(id, auth.uid()));

CREATE POLICY "Owner can delete their trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- trip_collaborators policies
-- ============================================================
CREATE POLICY "Owner can view collaborators of their trips"
  ON public.trip_collaborators FOR SELECT
  TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "User can view their own collaborator entries"
  ON public.trip_collaborators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can add collaborators"
  ON public.trip_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (public.is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "Owner can remove collaborators"
  ON public.trip_collaborators FOR DELETE
  TO authenticated
  USING (public.is_trip_owner(trip_id, auth.uid()));