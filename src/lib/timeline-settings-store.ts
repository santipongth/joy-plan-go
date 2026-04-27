import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  showMinutes: boolean;
  setShowMinutes: (v: boolean) => void;
}

export const useTimelineSettingsStore = create<State>()(
  persist(
    (set) => ({
      showMinutes: true,
      setShowMinutes: (showMinutes) => set({ showMinutes }),
    }),
    { name: "trip-planner-timeline-settings" },
  ),
);
