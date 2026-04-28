export type TravelMode = "any" | "walking" | "transit" | "mixed";

export type DaySlot = "morning" | "afternoon" | "evening" | "night";

export interface Place {
  id: string;
  name: string;
  description?: string;
  type?: string;
  time?: string;
  lat: number;
  lng: number;
  notes?: string;
  bookmarked?: boolean;
  slot?: DaySlot;
}

export interface PackingItem {
  id: string;
  label: string;
  category?: string;
  done?: boolean;
}

export type ExpenseCategory =
  | "food"
  | "transport"
  | "lodging"
  | "attraction"
  | "shopping"
  | "other";

export interface Expense {
  id: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  note?: string;
  dayIndex?: number; // 0-based day in itinerary; undefined => trip-level
  createdAt: number;
}

export interface DayStartPoint {
  label: string;
  lat?: number;
  lng?: number;
  placeId?: string; // when set, anchor uses this place's coordinates
}

export interface DayPlan {
  day: number;
  title?: string;
  places: Place[];
  travelMode?: TravelMode; // overrides itinerary.travelMode for this day
  startPoint?: DayStartPoint;
}

export type BudgetTier = "low" | "medium" | "high";

export interface Itinerary {
  id: string;
  title: string;
  origin?: string;
  destination: string;
  durationDays: number;
  startDate?: string;
  coverImage?: string;
  days: DayPlan[];
  citiesCount: number;
  travelMode?: TravelMode; // global default
  budget?: BudgetTier;
  travelers?: number;
  packing?: PackingItem[];
  expenses?: Expense[];
  createdAt: number;
  updatedAt: number;
}
