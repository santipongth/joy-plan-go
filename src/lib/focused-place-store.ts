import { create } from "zustand";

interface State {
  focusedId: string | null;
  ts: number;
  focus: (id: string) => void;
  clear: () => void;
}

export const useFocusedPlaceStore = create<State>()((set) => ({
  focusedId: null,
  ts: 0,
  focus: (id) => set({ focusedId: id, ts: Date.now() }),
  clear: () => set({ focusedId: null, ts: 0 }),
}));
