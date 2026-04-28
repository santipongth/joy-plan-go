-- Bucket for trip photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO NOTHING;

-- trip_photos table
CREATE TABLE public.trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  day_index integer,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_photos_trip ON public.trip_photos(trip_id);

ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their trip photos"
ON public.trip_photos FOR SELECT TO authenticated
USING (public.is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "Collaborators can view trip photos"
ON public.trip_photos FOR SELECT TO authenticated
USING (public.is_trip_collaborator(trip_id, auth.uid()));

CREATE POLICY "Anyone can view photos of public trips"
ON public.trip_photos FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.is_public = true));

CREATE POLICY "Owners can insert trip photos"
ON public.trip_photos FOR INSERT TO authenticated
WITH CHECK (public.is_trip_owner(trip_id, auth.uid()) AND owner_id = auth.uid());

CREATE POLICY "Collaborators can insert trip photos"
ON public.trip_photos FOR INSERT TO authenticated
WITH CHECK (public.is_trip_collaborator(trip_id, auth.uid()) AND owner_id = auth.uid());

CREATE POLICY "Owners can update trip photos"
ON public.trip_photos FOR UPDATE TO authenticated
USING (public.is_trip_owner(trip_id, auth.uid()) OR public.is_trip_collaborator(trip_id, auth.uid()));

CREATE POLICY "Owners can delete trip photos"
ON public.trip_photos FOR DELETE TO authenticated
USING (public.is_trip_owner(trip_id, auth.uid()) OR public.is_trip_collaborator(trip_id, auth.uid()));

CREATE TRIGGER update_trip_photos_updated_at
BEFORE UPDATE ON public.trip_photos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for trip-photos bucket
-- Path convention: <trip_id>/<filename>
CREATE POLICY "Public can read trip photos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'trip-photos');

CREATE POLICY "Trip members can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-photos'
  AND (
    public.is_trip_owner((storage.foldername(name))[1]::uuid, auth.uid())
    OR public.is_trip_collaborator((storage.foldername(name))[1]::uuid, auth.uid())
  )
);

CREATE POLICY "Trip members can update photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (
    public.is_trip_owner((storage.foldername(name))[1]::uuid, auth.uid())
    OR public.is_trip_collaborator((storage.foldername(name))[1]::uuid, auth.uid())
  )
);

CREATE POLICY "Trip members can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND (
    public.is_trip_owner((storage.foldername(name))[1]::uuid, auth.uid())
    OR public.is_trip_collaborator((storage.foldername(name))[1]::uuid, auth.uid())
  )
);