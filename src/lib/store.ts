import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Itinerary,
  Place,
  DayPlan,
  TravelMode,
  DayStartPoint,
  PackingItem,
  Expense,
  Lodging,
  TransportLeg,
} from "./types";

interface State {
  itineraries: Itinerary[];
  add: (it: Itinerary) => void;
  update: (id: string, patch: Partial<Itinerary>) => void;
  remove: (id: string) => void;
  get: (id: string) => Itinerary | undefined;
  duplicate: (id: string, newTitle?: string) => string | null;
  updateDays: (id: string, days: DayPlan[]) => void;
  addPlace: (id: string, dayIndex: number, place: Place) => void;
  removePlace: (id: string, dayIndex: number, placeId: string) => void;
  reorderPlaces: (id: string, dayIndex: number, places: Place[]) => void;
  replaceDay: (id: string, dayIndex: number, day: DayPlan) => void;
  movePlace: (id: string, fromDayIdx: number, toDayIdx: number, placeId: string) => void;
  setItineraryMode: (id: string, mode: TravelMode) => void;
  setDayMode: (id: string, dayIndex: number, mode: TravelMode | undefined) => void;
  setDayStart: (id: string, dayIndex: number, sp: DayStartPoint | undefined) => void;
  applyModeToAllDays: (id: string, mode: TravelMode | undefined) => void;
  updatePlace: (id: string, dayIndex: number, placeId: string, patch: Partial<Place>) => void;
  addPackingItem: (id: string, item: PackingItem) => void;
  updatePackingItem: (id: string, itemId: string, patch: Partial<PackingItem>) => void;
  removePackingItem: (id: string, itemId: string) => void;
  setPacking: (id: string, items: PackingItem[]) => void;
  addExpense: (id: string, exp: Expense) => void;
  updateExpense: (id: string, expId: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string, expId: string) => void;
  addLodging: (id: string, lodging: Lodging) => void;
  updateLodging: (id: string, lodgingId: string, patch: Partial<Lodging>) => void;
  removeLodging: (id: string, lodgingId: string) => void;
  setLodgingDays: (id: string, lodgingId: string, dayIndexes: number[]) => void;
  setDayTransport: (id: string, dayIndex: number, legs: TransportLeg[] | undefined) => void;
}

const touch = (it: Itinerary): Itinerary => ({ ...it, updatedAt: Date.now() });

export const useItineraryStore = create<State>()(
  persist(
    (set, get) => ({
      itineraries: [],
      add: (it) => set((s) => ({ itineraries: [touch(it), ...s.itineraries] })),
      update: (id, patch) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => (i.id === id ? touch({ ...i, ...patch }) : i)),
        })),
      remove: (id) =>
        set((s) => ({ itineraries: s.itineraries.filter((i) => i.id !== id) })),
      get: (id) => get().itineraries.find((i) => i.id === id),
      duplicate: (id, newTitle) => {
        const src = get().itineraries.find((i) => i.id === id);
        if (!src) return null;
        const newId = makeId();
        const cloned: Itinerary = {
          ...src,
          id: newId,
          title: newTitle ?? src.title,
          days: src.days.map((d) => ({
            ...d,
            places: d.places.map((p) => ({ ...p, id: makeId() })),
            startPoint: d.startPoint ? { ...d.startPoint } : undefined,
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ itineraries: [cloned, ...s.itineraries] }));
        return newId;
      },
      updateDays: (id, days) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => (i.id === id ? touch({ ...i, days }) : i)),
        })),
      addPlace: (id, dayIndex, place) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) =>
              idx === dayIndex ? { ...d, places: [...d.places, place] } : d
            );
            return touch({ ...i, days });
          }),
        })),
      removePlace: (id, dayIndex, placeId) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) =>
              idx === dayIndex ? { ...d, places: d.places.filter((p) => p.id !== placeId) } : d
            );
            return touch({ ...i, days });
          }),
        })),
      reorderPlaces: (id, dayIndex, places) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) => (idx === dayIndex ? { ...d, places } : d));
            return touch({ ...i, days });
          }),
        })),
      replaceDay: (id, dayIndex, day) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) => {
              if (idx !== dayIndex) return d;
              // Preserve user-chosen travelMode and startPoint across AI regeneration.
              // If previous startPoint referenced a placeId from old places, remap it
              // to the new places by name match; otherwise keep stored lat/lng so
              // resolveAnchor still works.
              const prevSP = d.startPoint;
              let nextSP: DayStartPoint | undefined = day.startPoint ?? prevSP;
              if (!day.startPoint && prevSP?.placeId && Array.isArray(day.places)) {
                const oldPlace = d.places.find((p) => p.id === prevSP.placeId);
                const matched = oldPlace
                  ? day.places.find((p) => p.name === oldPlace.name)
                  : undefined;
                if (matched) {
                  nextSP = {
                    label: prevSP.label,
                    placeId: matched.id,
                    lat: matched.lat,
                    lng: matched.lng,
                  };
                } else if (
                  typeof prevSP.lat === "number" &&
                  typeof prevSP.lng === "number"
                ) {
                  nextSP = { label: prevSP.label, lat: prevSP.lat, lng: prevSP.lng };
                } else {
                  nextSP = { label: prevSP.label };
                }
              }
              return {
                ...day,
                travelMode: day.travelMode ?? d.travelMode,
                startPoint: nextSP,
              };
            });
            return touch({ ...i, days });
          }),
        })),
      movePlace: (id, fromDayIdx, toDayIdx, placeId) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            if (fromDayIdx === toDayIdx) return i;
            const moving = i.days[fromDayIdx]?.places.find((p) => p.id === placeId);
            if (!moving) return i;
            const days = i.days.map((d, idx) => {
              if (idx === fromDayIdx) return { ...d, places: d.places.filter((p) => p.id !== placeId) };
              if (idx === toDayIdx) return { ...d, places: [...d.places, moving] };
              return d;
            });
            return touch({ ...i, days });
          }),
        })),
      setItineraryMode: (id, mode) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => (i.id === id ? touch({ ...i, travelMode: mode }) : i)),
        })),
      setDayMode: (id, dayIndex, mode) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) => (idx === dayIndex ? { ...d, travelMode: mode } : d));
            return touch({ ...i, days });
          }),
        })),
      setDayStart: (id, dayIndex, sp) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) => (idx === dayIndex ? { ...d, startPoint: sp } : d));
            return touch({ ...i, days });
          }),
        })),
      applyModeToAllDays: (id, mode) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d) => ({ ...d, travelMode: mode }));
            return touch({ ...i, days });
          }),
        })),
      updatePlace: (id, dayIndex, placeId, patch) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) => {
            if (i.id !== id) return i;
            const days = i.days.map((d, idx) =>
              idx === dayIndex
                ? {
                    ...d,
                    places: d.places.map((p) => (p.id === placeId ? { ...p, ...patch } : p)),
                  }
                : d
            );
            return touch({ ...i, days });
          }),
        })),
      addPackingItem: (id, item) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id ? touch({ ...i, packing: [...(i.packing ?? []), item] }) : i
          ),
        })),
      updatePackingItem: (id, itemId, patch) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id
              ? touch({
                  ...i,
                  packing: (i.packing ?? []).map((p) =>
                    p.id === itemId ? { ...p, ...patch } : p
                  ),
                })
              : i
          ),
        })),
      removePackingItem: (id, itemId) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id
              ? touch({ ...i, packing: (i.packing ?? []).filter((p) => p.id !== itemId) })
              : i
          ),
        })),
      setPacking: (id, items) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id ? touch({ ...i, packing: items }) : i
          ),
        })),
      addExpense: (id, exp) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id ? touch({ ...i, expenses: [...(i.expenses ?? []), exp] }) : i
          ),
        })),
      updateExpense: (id, expId, patch) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id
              ? touch({
                  ...i,
                  expenses: (i.expenses ?? []).map((e) =>
                    e.id === expId ? { ...e, ...patch } : e
                  ),
                })
              : i
          ),
        })),
      removeExpense: (id, expId) =>
        set((s) => ({
          itineraries: s.itineraries.map((i) =>
            i.id === id
              ? touch({ ...i, expenses: (i.expenses ?? []).filter((e) => e.id !== expId) })
              : i
          ),
        })),
    }),
    {
      name: "trip-planner-itineraries",
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        if (version < 2 && Array.isArray(persistedState.itineraries)) {
          persistedState.itineraries = persistedState.itineraries.map((it: any) => ({
            ...it,
            days: Array.isArray(it.days)
              ? it.days.map((d: any) => ({
                  travelMode: d?.travelMode,
                  startPoint: d?.startPoint,
                  ...d,
                }))
              : it.days,
          }));
        }
        if (version < 3 && Array.isArray(persistedState.itineraries)) {
          // Backfill lat/lng on startPoints that referenced a placeId but never
          // stored coordinates, so resolveAnchor keeps working after refresh.
          persistedState.itineraries = persistedState.itineraries.map((it: any) => ({
            ...it,
            days: Array.isArray(it.days)
              ? it.days.map((d: any) => {
                  const sp = d?.startPoint;
                  if (
                    sp &&
                    sp.placeId &&
                    (typeof sp.lat !== "number" || typeof sp.lng !== "number") &&
                    Array.isArray(d.places)
                  ) {
                    const match = d.places.find((p: any) => p?.id === sp.placeId);
                    if (match && typeof match.lat === "number" && typeof match.lng === "number") {
                      return {
                        ...d,
                        startPoint: { ...sp, lat: match.lat, lng: match.lng },
                      };
                    }
                  }
                  return d;
                })
              : it.days,
          }));
        }
        return persistedState;
      },
    }
  )
);

export function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
