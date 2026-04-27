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

import type { CurrencyCode } from "./currency-store";

interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  /** Multiplier from USD → currency. */
  rate: number;
  /** Whole-number currency? (no decimals shown) */
  whole?: boolean;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: "USD", symbol: "US$", rate: 1 },
  THB: { code: "THB", symbol: "฿", rate: 36, whole: true },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  JPY: { code: "JPY", symbol: "¥", rate: 155, whole: true },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
};

export function formatMoney(usd: number, currency: CurrencyCode = "USD"): string {
  const meta = CURRENCIES[currency] ?? CURRENCIES.USD;
  const converted = usd * meta.rate;
  const rounded = meta.whole ? Math.round(converted) : Math.round(converted);
  return `${meta.symbol}${rounded.toLocaleString("en-US")}`;
}

/** Backwards-compat helper. */
export function formatUSD(n: number): string {
  return formatMoney(n, "USD");
}

export interface DayBudget {
  day: number;
  stay: number;
  attractions: number;
  transportation: number;
  total: number;
}

export function estimateBudgetByDay(
  it: Itinerary,
  travelers: number,
  tier: BudgetTier,
): DayBudget[] {
  const mult = TIER_MULT[tier];
  const trav = Math.max(1, travelers);
  const nights = Math.max(0, it.durationDays - 1);
  const stayPerNight = 35 * trav * mult;
  const interCity =
    it.origin && it.origin.trim() && it.origin.trim() !== it.destination.trim()
      ? 200 * trav * mult
      : 0;

  return it.days.map((d, idx) => {
    const isLast = idx === it.days.length - 1;
    const stay = nights > 0 && !isLast ? roundTo5(stayPerNight) : 0;
    const attractionCount = d.places.filter((p) => isPaidAttraction(p.type)).length;
    const attractions = roundTo5(attractionCount * 15 * trav * mult);
    const mode: TravelMode = d.travelMode ?? it.travelMode ?? "any";
    const intra = (TRANSPORT_PER_DAY[mode] ?? TRANSPORT_PER_DAY.any) * trav * mult;
    const transportation = roundTo5(intra + (idx === 0 ? interCity : 0));
    return {
      day: d.day ?? idx + 1,
      stay,
      attractions,
      transportation,
      total: stay + attractions + transportation,
    };
  });
}

