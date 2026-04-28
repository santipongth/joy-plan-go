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

export interface BoundsBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export async function searchInBounds(
  query: string,
  bounds: BoundsBox,
  lang: string,
): Promise<NominatimPlace[]> {
  const q = query.trim() || "tourism";
  // viewbox = left(west), top(north), right(east), bottom(south)
  const viewbox = `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=10&addressdetails=0&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1&accept-language=${lang}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    return (await res.json()) as NominatimPlace[];
  } catch {
    return [];
  }
}
