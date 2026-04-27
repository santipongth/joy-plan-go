import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MapStyle = "streets" | "satellite" | "minimal";

interface State {
  style: MapStyle;
  setStyle: (s: MapStyle) => void;
}

export const useMapStyleStore = create<State>()(
  persist(
    (set) => ({
      style: "streets",
      setStyle: (style) => set({ style }),
    }),
    { name: "trip-planner-map-style" },
  ),
);

export const TILES: Record<
  MapStyle,
  { url: string; maxZoom: number; subdomains?: string }
> = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
  },
  minimal: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxZoom: 19,
    subdomains: "abcd",
  },
};
