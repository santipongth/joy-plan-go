import { create } from "zustand";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
}

interface State {
  bounds: MapBounds | null;
  setBounds: (b: MapBounds) => void;
}

export const useMapBoundsStore = create<State>((set) => ({
  bounds: null,
  setBounds: (b) => set({ bounds: b }),
}));
