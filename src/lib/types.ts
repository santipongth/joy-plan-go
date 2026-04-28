export type TravelMode = "any" | "walking" | "transit" | "mixed";

export type DaySlot = "morning" | "afternoon" | "evening" | "night";

export type PlaceKind = "attraction" | "meal" | "transit" | "stay";

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
  kind?: PlaceKind;
}

export interface LocalTips {
  generatedAt: number;
  lang: "th" | "en";
  dressCode?: string;
  tipping?: string;
  language?: string;
  hours?: string;
  festivals?: string;
  etiquette?: string;
  safety?: string;
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

export type LodgingType =
  | "hotel"
  | "hostel"
  | "resort"
  | "guesthouse"
  | "apartment";

export interface Lodging {
  id: string;
  name: string;
  type: LodgingType;
  lat: number;
  lng: number;
  address?: string;
  priceTier?: BudgetTier;
  pricePerNight?: number;
  currency?: string;
  rating?: number; // 0..5
  description?: string;
  amenities?: string[];
  bookingUrl?: string;
  dayIndexes?: number[]; // which day indexes (0-based) this lodging covers
  createdAt: number;
}

export type TransportMode =
  | "walk"
  | "transit"
  | "subway"
  | "bus"
  | "train"
  | "taxi"
  | "rideshare"
  | "ferry"
  | "bike"
  | "car";

export interface TransportAlternative {
  mode: TransportMode;
  durationMin?: number;
  costEstimate?: number;
  note?: string;
}

export interface TransportLeg {
  id: string;
  fromPlaceId: string; // empty string => from the day's start anchor
  toPlaceId: string;
  mode: TransportMode;
  durationMin?: number;
  distanceKm?: number;
  costEstimate?: number;
  currency?: string;
  instructions?: string;
  alternatives?: TransportAlternative[];
}

export interface DayPlan {
  day: number;
  title?: string;
  places: Place[];
  travelMode?: TravelMode; // overrides itinerary.travelMode for this day
  startPoint?: DayStartPoint;
  transport?: TransportLeg[];
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
  lodgings?: Lodging[];
  localTips?: LocalTips;
  createdAt: number;
  updatedAt: number;
}
