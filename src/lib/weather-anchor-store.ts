import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  // map: itinerary id -> place id ("auto" = first place)
  anchors: Record<string, string>;
  setAnchor: (tripId: string, placeId: string) => void;
}

export const useWeatherAnchorStore = create<State>()(
  persist(
    (set) => ({
      anchors: {},
      setAnchor: (tripId, placeId) =>
        set((s) => ({ anchors: { ...s.anchors, [tripId]: placeId } })),
    }),
    { name: "trip-planner-weather-anchor" },
  ),
);
