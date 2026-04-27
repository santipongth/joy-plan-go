## Goals

1. Travel mode can be set globally (whole trip) **or** overridden per day, with a "Re-order this day" button per day.
2. Each day shows a short "why this order" explanation.
3. Each day shows estimated total walking/transit time + distance.
4. Each day can have a custom **start point** (hotel / district / one of the day's places) that anchors the reorder.

## What you'll see

On `/itinerary/:id`, a new **Travel mode bar** at the top of the day list:
- Mode selector: Any / Walking / Transit / Mixed (applies to all days by default)
- "Apply to all days" button

On every day card, a new compact **Route panel** above the place list:
- Mode override (Inherit / Walking / Transit / Mixed)
- Start point selector (Trip origin / Custom text / Pick a place from this day)
- Estimated total: e.g. `~4.2 km · ~52 min walking`
- One-line reasoning: e.g. *"Ordered by nearest-neighbour from Hotel Sukhumvit; minimises backtracking, longest leg 1.1 km."*
- **"Update this day's order"** button → re-runs the local nearest-neighbour reorder using that day's mode + start point (no AI call, instant)

```text
┌─ Day 1: Old Town ───────────────────────────────┐
│ Mode: [Inherit ▾]   Start: [Hotel Riva ▾]       │
│ ~3.8 km · ~46 min walking                       │
│ Closest-first from Hotel Riva, longest leg 0.9km│
│ [Update this day's order]                       │
│  1. Wat Pho   09:00                             │
│  2. ...                                         │
└─────────────────────────────────────────────────┘
```

## Technical details

**Types (`src/lib/types.ts`)**
- Add `travelMode?: TravelMode` to `Itinerary` (global default).
- Add `travelMode?: TravelMode` and `startPoint?: { label: string; lat?: number; lng?: number; placeId?: string }` to `DayPlan`.

**Store (`src/lib/store.ts`)**
- Add `setItineraryMode(id, mode)`, `setDayMode(id, dayIdx, mode)`, `setDayStart(id, dayIdx, sp)`, `applyModeToAllDays(id, mode)`. All `touch()` updatedAt.

**Server geo helpers (`src/server/dedupe.ts`)** — already has `reorderPlacesByDistance` + `travelCostMeters`. Add a small client-safe twin **`src/lib/route-utils.ts`** so the itinerary page can reorder without an AI call:
- Re-export pure functions: `haversineMeters`, `travelCostMeters`, `reorderPlacesFromAnchor(places, anchor, mode)`.
- `estimateDayTravel(places, mode, anchor?)` → `{ totalMeters, totalMinutes, longestLegMeters, legs }`.
  - Walking speed: 4.8 km/h. Transit average: 18 km/h with 4 min wait per leg. Mixed: 8 km/h.
- `routeReasoning(mode, anchorLabel?, longestLegMeters)` → localized one-liner.

**Itinerary page (`src/routes/itinerary.$id.tsx`)**
- New top "Travel mode" toolbar (uses store `itinerary.travelMode`).
- For each day, render a `<DayRoutePanel>`:
  - Mode = `day.travelMode ?? itinerary.travelMode ?? "any"`.
  - Anchor resolution: `day.startPoint` → if `placeId`, use that place's lat/lng; if has lat/lng, use those; else use itinerary `origin` (geocoded fallback: just label, anchor = first place); else first place in the day.
  - Show stats from `estimateDayTravel`.
  - Buttons:
    - **Update this day's order**: call `reorderPlacesFromAnchor`, push via `reorderPlaces(id, dayIdx, newOrder)`. Toast "Day N reordered".
    - Mode dropdown sets `day.travelMode`.
    - Start point dropdown lists: `Inherit (trip origin)`, places in this day, `Custom…` (prompt for label) — saved to `day.startPoint`.

**Server prompt (`src/server/plan-trip.functions.ts`)**
- When generating, pass `day.startPoint?.label` (if present) into `planSingleDay` so AI orders from that anchor. New optional `startLabel` field on `PlanDayInput`. Used in user prompt: `Start the day at: ${startLabel}.`

**i18n (`src/lib/i18n.ts`)**
- Add: `applyToAll`, `inherit`, `startPoint`, `customStart`, `pickFromDay`, `updateDayOrder`, `dayReordered`, `routeStats` (`"~{km} km · ~{min} min {mode}"`), `reasonNearestFrom` (`"Closest-first from {start}; longest leg {km} km"`), `reasonNoMode` (`"AI default order — pick a mode to optimise"`).

## Files

- edit `src/lib/types.ts`
- edit `src/lib/store.ts`
- new `src/lib/route-utils.ts`
- edit `src/routes/itinerary.$id.tsx` (toolbar + DayRoutePanel)
- edit `src/server/plan-trip.functions.ts` (accept `startLabel`)
- edit `src/lib/i18n.ts`

No new dependencies. All reordering on the itinerary page is instant/client-side; AI is only used when you explicitly regenerate a day.
