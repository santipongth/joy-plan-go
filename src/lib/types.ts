export interface Place {
  id: string;
  name: string;
  description?: string;
  type?: string;
  time?: string;
  lat: number;
  lng: number;
}

export interface DayPlan {
  day: number;
  title?: string;
  places: Place[];
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
  createdAt: number;
  updatedAt: number;
}
