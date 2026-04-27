export interface PlaceLite {
  name: string;
  lat: number;
  lng: number;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSimilarPlace(
  a: PlaceLite,
  b: PlaceLite,
  thresholdMeters = 150,
): boolean {
  if (
    typeof a.lat === "number" &&
    typeof a.lng === "number" &&
    typeof b.lat === "number" &&
    typeof b.lng === "number"
  ) {
    if (haversineMeters(a, b) <= thresholdMeters) return true;
  }
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (na && nb && na === nb) return true;
  return false;
}

export function filterDuplicatesAgainst<T extends PlaceLite>(
  candidates: T[],
  existing: PlaceLite[],
  thresholdMeters = 150,
): T[] {
  return candidates.filter((c) => !existing.some((e) => isSimilarPlace(c, e, thresholdMeters)));
}

export function dedupePlacesAcrossDays<P extends PlaceLite>(
  days: { day: number; title: string; places: P[] }[],
  thresholdMeters = 150,
): { day: number; title: string; places: P[] }[] {
  const accepted: PlaceLite[] = [];
  return days.map((d) => {
    const kept: P[] = [];
    for (const p of d.places) {
      if (accepted.some((e) => isSimilarPlace(p, e, thresholdMeters))) continue;
      kept.push(p);
      accepted.push({ name: p.name, lat: p.lat, lng: p.lng });
    }
    return { ...d, places: kept };
  });
}
