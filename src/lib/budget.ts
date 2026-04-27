import type { BudgetTier, Itinerary, TravelMode } from "./types";

export interface BudgetBreakdown {
  total: number;
  transportation: number;
  attractions: number;
  stay: number;
  /** Total at the highest tier (luxury) — used to scale the progress bar. */
  maxScale: number;
  travelers: number;
  tier: BudgetTier;
}

const TIER_MULT: Record<BudgetTier, number> = {
  low: 0.6,
  medium: 1.0,
  high: 1.8,
};

export const MIN_TRAVELERS = 1;
export const MAX_TRAVELERS = 20;

export const PAID_ATTRACTION_TYPES = new Set([
  "museum",
  "attraction",
  "landmark",
  "park",
  "theme",
  "tour",
  "show",
  "gallery",
  "temple",
  "shrine",
  "monument",
  "zoo",
  "aquarium",
]);

const TRANSPORT_PER_DAY: Record<TravelMode, number> = {
  walking: 5,
  transit: 15,
  mixed: 25,
  any: 30,
};

function isPaidAttraction(type?: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  if (!t) return false;
  // Match if any token in the type string belongs to the paid set.
  return t.split(/[\s,/_-]+/).some((tok) => PAID_ATTRACTION_TYPES.has(tok));
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

function computeForTier(
  it: Itinerary,
  travelers: number,
  tier: BudgetTier,
): { transportation: number; attractions: number; stay: number; total: number } {
  const mult = TIER_MULT[tier];
  const trav = Math.max(1, travelers);

  // Stay: nights = durationDays - 1 (return-trip travelers); base $35/night/traveler.
  const nights = Math.max(0, it.durationDays - 1);
  const stay = roundTo5(nights * 35 * trav * mult);

  // Attractions: $15 per paid attraction per traveler.
  const attractionCount = it.days.reduce(
    (sum, d) => sum + d.places.filter((p) => isPaidAttraction(p.type)).length,
    0,
  );
  const attractions = roundTo5(attractionCount * 15 * trav * mult);

  // Transportation: per-day rate by mode, plus inter-city allowance.
  const intraDay = it.days.reduce((sum, d) => {
    const mode: TravelMode = d.travelMode ?? it.travelMode ?? "any";
    return sum + (TRANSPORT_PER_DAY[mode] ?? TRANSPORT_PER_DAY.any);
  }, 0);
  const interCity =
    it.origin && it.origin.trim() && it.origin.trim() !== it.destination.trim()
      ? 200
      : 0;
  const transportation = roundTo5((intraDay * trav + interCity * trav) * mult);

  const total = stay + attractions + transportation;
  return { transportation, attractions, stay, total };
}

export function estimateBudget(
  itinerary: Itinerary,
  travelers: number,
  tier: BudgetTier,
): BudgetBreakdown {
  const trav = Math.max(1, travelers);
  const cur = computeForTier(itinerary, trav, tier);
  const max = computeForTier(itinerary, trav, "high");
  return {
    ...cur,
    maxScale: Math.max(cur.total, max.total, 1),
    travelers: trav,
    tier,
  };
}

export function formatUSD(n: number): string {
  return `US$${Math.round(n).toLocaleString("en-US")}`;
}
