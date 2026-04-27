export type TravelMode = "any" | "walking" | "transit" | "mixed";

export interface Place {
  id: string;
  name: string;
  description?: string;
  type?: string;
  time?: string;
  lat: number;
  lng: number;
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
  createdAt: number;
  updatedAt: number;
}
