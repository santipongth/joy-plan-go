import { supabase } from "@/integrations/supabase/client";
import type { Itinerary } from "./types";

/**
 * Map a local Itinerary (uses string id, createdAt/updatedAt as numbers)
 * to/from a cloud row. The local id is stored in `client_id` so existing
 * routes (which use the local id in URLs) keep working.
 */

export interface CloudTripRow {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  destination: string;
  duration_days: number;
  cover_image: string | null;
  is_public: boolean;
  data: any;
  created_at: string;
  updated_at: string;
}

export function rowToItinerary(row: CloudTripRow): Itinerary & { cloudId: string; isPublic: boolean; ownerId: string } {
  const base = (row.data ?? {}) as Itinerary;
  return {
    ...base,
    id: row.client_id || row.id,
    title: row.title,
    destination: row.destination,
    durationDays: row.duration_days,
    coverImage: row.cover_image ?? base.coverImage,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    cloudId: row.id,
    isPublic: row.is_public,
    ownerId: row.owner_id,
  };
}

export async function pushTrip(it: Itinerary, ownerId: string, opts?: { isPublic?: boolean }) {
  // upsert by (owner_id, client_id)
  const payload = {
    owner_id: ownerId,
    client_id: it.id,
    title: it.title,
    destination: it.destination,
    duration_days: it.durationDays,
    cover_image: it.coverImage ?? null,
    is_public: opts?.isPublic ?? false,
    data: it,
  };
  const { data, error } = await supabase
    .from("trips")
    .upsert([payload as any], { onConflict: "owner_id,client_id" })
    .select()
    .single();
  if (error) throw error;
  return data as CloudTripRow;
}

export async function updateTripMeta(
  cloudId: string,
  patch: Partial<{ title: string; destination: string; is_public: boolean; cover_image: string | null }>,
) {
  const { error } = await supabase.from("trips").update(patch).eq("id", cloudId);
  if (error) throw error;
}

export async function fetchMyTrips(ownerId: string) {
  // Owned trips
  const { data: owned, error: e1 } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (e1) throw e1;
  // Trips shared with me
  const { data: shared, error: e2 } = await supabase
    .from("trip_collaborators")
    .select("trip_id, trips(*)")
    .eq("user_id", ownerId);
  if (e2) throw e2;
  const sharedTrips = (shared ?? [])
    .map((r: any) => r.trips as CloudTripRow)
    .filter(Boolean);
  return { owned: (owned as CloudTripRow[]) ?? [], shared: sharedTrips };
}

export async function fetchPublicTrips(limit = 60) {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CloudTripRow[]) ?? [];
}

export async function fetchTripByCloudId(cloudId: string) {
  const { data, error } = await supabase.from("trips").select("*").eq("id", cloudId).maybeSingle();
  if (error) throw error;
  return data as CloudTripRow | null;
}

export async function deleteTripByClientId(ownerId: string, clientId: string) {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("owner_id", ownerId)
    .eq("client_id", clientId);
  if (error) throw error;
}

// ---------- Collaborators ----------

export async function fetchCollaborators(cloudId: string) {
  const { data, error } = await supabase
    .from("trip_collaborators")
    .select("id, user_id, role, created_at, profiles!inner(display_name, avatar_url)")
    .eq("trip_id", cloudId);
  if (error) throw error;
  return data ?? [];
}

export async function addCollaboratorByEmail(cloudId: string, email: string) {
  // Find profile by display_name email match? We don't store email in profiles.
  // Instead: look up via auth.users via a public RPC isn't available.
  // Alternative: search profiles where display_name matches email prefix; but not reliable.
  // Best path: ask user to share by user id or implement an invite. For simplicity here,
  // we accept either an exact display_name match OR a user_id (uuid).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
  let userId: string | null = null;
  if (isUuid) {
    userId = email;
  } else {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .ilike("display_name", email.split("@")[0])
      .limit(1);
    if (pErr) throw pErr;
    if (profs && profs.length > 0) userId = profs[0].user_id;
  }
  if (!userId) throw new Error("USER_NOT_FOUND");
  const { error } = await supabase
    .from("trip_collaborators")
    .insert({ trip_id: cloudId, user_id: userId, role: "editor" });
  if (error) throw error;
  return userId;
}

export async function removeCollaborator(collaboratorRowId: string) {
  const { error } = await supabase
    .from("trip_collaborators")
    .delete()
    .eq("id", collaboratorRowId);
  if (error) throw error;
}
