import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VisibilityState {
  visibleDaysByItinerary: Record<string, number[]>;
  getVisible: (id: string) => number[] | undefined;
  setVisible: (id: string, days: number[]) => void;
  toggle: (id: string, day: number) => void;
}

export const useVisibilityStore = create<VisibilityState>()(
  persist(
    (set, get) => ({
      visibleDaysByItinerary: {},
      getVisible: (id) => get().visibleDaysByItinerary[id],
      setVisible: (id, days) =>
        set((s) => ({
          visibleDaysByItinerary: { ...s.visibleDaysByItinerary, [id]: [...days].sort((a, b) => a - b) },
        })),
      toggle: (id, day) =>
        set((s) => {
          const current = s.visibleDaysByItinerary[id] ?? [];
          const next = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day].sort((a, b) => a - b);
          return {
            visibleDaysByItinerary: { ...s.visibleDaysByItinerary, [id]: next },
          };
        }),
    }),
    { name: "trip-planner-visibility" }
  )
);
