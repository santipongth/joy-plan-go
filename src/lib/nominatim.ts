export interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  type?: string;
  name?: string;
}

export async function searchPlaces(query: string, lang: string): Promise<NominatimPlace[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=0&q=${encodeURIComponent(query)}&accept-language=${lang}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    return (await res.json()) as NominatimPlace[];
  } catch {
    return [];
  }
}
