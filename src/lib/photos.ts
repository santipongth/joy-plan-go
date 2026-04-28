import { supabase } from "@/integrations/supabase/client";

export interface TripPhoto {
  id: string;
  trip_id: string;
  owner_id: string;
  day_index: number | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export function publicUrlFor(path: string) {
  return supabase.storage.from("trip-photos").getPublicUrl(path).data.publicUrl;
}

export async function listTripPhotos(cloudTripId: string): Promise<TripPhoto[]> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("*")
    .eq("trip_id", cloudTripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TripPhoto[]) ?? [];
}

export async function uploadTripPhoto(opts: {
  cloudTripId: string;
  ownerId: string;
  dayIndex: number | null;
  file: File;
}): Promise<TripPhoto> {
  const ext = opts.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${opts.cloudTripId}/${filename}`;
  const { error: upErr } = await supabase.storage
    .from("trip-photos")
    .upload(path, opts.file, { contentType: opts.file.type, upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("trip_photos")
    .insert({
      trip_id: opts.cloudTripId,
      owner_id: opts.ownerId,
      day_index: opts.dayIndex,
      storage_path: path,
      caption: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TripPhoto;
}

export async function updatePhotoCaption(id: string, caption: string) {
  const { error } = await supabase
    .from("trip_photos")
    .update({ caption })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTripPhoto(photo: TripPhoto) {
  await supabase.storage.from("trip-photos").remove([photo.storage_path]);
  const { error } = await supabase.from("trip_photos").delete().eq("id", photo.id);
  if (error) throw error;
}
