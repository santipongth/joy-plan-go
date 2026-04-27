import { create } from "zustand";
import type { Place } from "./types";

const MAX = 3;

type Key = string; // `${itineraryId}:${dayIndex}`

interface State {
  stacks: Record<Key, Place[][]>;
  push: (itineraryId: string, dayIndex: number, prev: Place[]) => void;
  pop: (itineraryId: string, dayIndex: number) => Place[] | undefined;
  depth: (itineraryId: string, dayIndex: number) => number;
  clear: (itineraryId: string, dayIndex?: number) => void;
}

const k = (id: string, idx: number): Key => `${id}:${idx}`;

export const useReorderHistoryStore = create<State>()((set, get) => ({
  stacks: {},
  push: (id, idx, prev) =>
    set((s) => {
      const key = k(id, idx);
      const cur = s.stacks[key] ?? [];
      const next = [...cur, prev].slice(-MAX);
      return { stacks: { ...s.stacks, [key]: next } };
    }),
  pop: (id, idx) => {
    const key = k(id, idx);
    const cur = get().stacks[key];
    if (!cur || cur.length === 0) return undefined;
    const last = cur[cur.length - 1];
    const rest = cur.slice(0, -1);
    set((s) => ({ stacks: { ...s.stacks, [key]: rest } }));
    return last;
  },
  depth: (id, idx) => get().stacks[k(id, idx)]?.length ?? 0,
  clear: (id, idx) =>
    set((s) => {
      if (idx === undefined) {
        const next = { ...s.stacks };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${id}:`)) delete next[key];
        });
        return { stacks: next };
      }
      const next = { ...s.stacks };
      delete next[k(id, idx)];
      return { stacks: next };
    }),
}));
