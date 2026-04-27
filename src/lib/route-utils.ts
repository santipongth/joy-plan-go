import type { Place, TravelMode, DayStartPoint } from "./types";

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

/** Effective traversal cost (meters) between two coordinates given mode. */
export function travelCostMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  mode: TravelMode,
): number {
  const d = haversineMeters(a, b);
  if (mode === "walking") return d;
  if (mode === "transit") return d + 600;
  if (mode === "mixed") return d + 250;
  return d;
}

/** Speeds in km/h plus a per-leg overhead in minutes. */
function modeProfile(mode: TravelMode): { kmh: number; overheadMin: number; label: string } {
  switch (mode) {
    case "walking":
      return { kmh: 4.8, overheadMin: 0, label: "walking" };
    case "transit":
      return { kmh: 18, overheadMin: 4, label: "transit" };
    case "mixed":
      return { kmh: 8, overheadMin: 2, label: "mixed" };
    default:
      return { kmh: 30, overheadMin: 0, label: "any" };
  }
}

/**
 * Reorder places along a nearest-neighbour path starting from `anchor`.
 * If anchor is null, anchors on the first place (keeps it first).
 */
export function reorderPlacesFromAnchor<P extends { lat: number; lng: number }>(
  places: P[],
  anchor: { lat: number; lng: number } | null,
  mode: TravelMode,
): P[] {
  if (mode === "any" || places.length <= 1) return places;
  const remaining = [...places];
  const ordered: P[] = [];
  let current: { lat: number; lng: number };
  if (anchor) {
    current = anchor;
  } else {
    current = remaining.shift()!;
    ordered.push(current as P);
  }
  while (remaining.length) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = travelCostMeters(current, remaining[i], mode);
      if (c < bestCost) {
        bestCost = c;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = next;
  }
  return ordered;
}

export interface DayTravelEstimate {
  totalMeters: number;
  totalMinutes: number;
  longestLegMeters: number;
  legs: number;
  modeLabel: string;
}

/** Estimate total walking/transit distance + minutes through a day's places. */
export function estimateDayTravel(
  places: Place[],
  mode: TravelMode,
  anchor?: { lat: number; lng: number } | null,
): DayTravelEstimate {
  const profile = modeProfile(mode);
  if (places.length === 0) {
    return { totalMeters: 0, totalMinutes: 0, longestLegMeters: 0, legs: 0, modeLabel: profile.label };
  }
  let totalMeters = 0;
  let longestLegMeters = 0;
  let legs = 0;
  let prev: { lat: number; lng: number } | null = anchor ?? null;
  for (const p of places) {
    if (prev) {
      const d = haversineMeters(prev, p);
      totalMeters += d;
      if (d > longestLegMeters) longestLegMeters = d;
      legs += 1;
    }
    prev = p;
  }
  const km = totalMeters / 1000;
  const totalMinutes = Math.round((km / profile.kmh) * 60 + profile.overheadMin * legs);
  return { totalMeters, totalMinutes, longestLegMeters, legs, modeLabel: profile.label };
}

/** Resolve an anchor coordinate from a DayStartPoint + the day's places. */
export function resolveAnchor(
  startPoint: DayStartPoint | undefined,
  places: Place[],
): { lat: number; lng: number } | null {
  if (!startPoint) return null;
  if (startPoint.placeId) {
    const found = places.find((p) => p.id === startPoint.placeId);
    if (found) return { lat: found.lat, lng: found.lng };
  }
  if (typeof startPoint.lat === "number" && typeof startPoint.lng === "number") {
    return { lat: startPoint.lat, lng: startPoint.lng };
  }
  return null;
}
