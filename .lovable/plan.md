## Goals

1. Make sure each day's `travelMode` and `startPoint` survive a page refresh.
2. Replace the `window.prompt` "custom start" picker with a searchable dropdown of candidate start points.
3. Add a per-day mini map that draws the day's ordered route as a polyline starting from the selected start point.

---

## 1. Persist per-day travel settings

The Zustand store already uses `persist({ name: "trip-planner-itineraries" })` and `setDayMode` / `setDayStart` mutate `day.travelMode` / `day.startPoint` inside the persisted `itineraries` array, so values *are* written to localStorage. What's missing is guaranteeing they round-trip cleanly:

- Add `travelMode?: TravelMode` and `startPoint?: DayStartPoint` to the `DayPlan` shape returned by `planSingleDay` / `planTrip` server functions in `src/server/plan-trip.functions.ts` so newly generated days don't strip them when the AI re-renders a day.
- In `src/lib/store.ts`, bump the persist config with `version: 2` and a tiny `migrate` that ensures `days[i].travelMode` / `days[i].startPoint` exist (default `undefined`). This protects users who already have data from the previous version and avoids hydration warnings.
- In `replaceDay` (used after AI regeneration of a single day), preserve the previous day's `travelMode` and `startPoint` unless the new `DayPlan` explicitly provides them — otherwise the AI re-gen will silently wipe the user's chosen start.

## 2. Searchable start-point dropdown

Replace the `window.prompt` flow inside `DayRoutePanel` (`src/routes/itinerary.$id.tsx`, ~line 1168) with a shadcn `Command` (cmdk) popover.

Source list (in order):
1. "Inherit from trip" → clears `startPoint` (uses trip origin).
2. Trip origin (`itinerary.origin`) as a pickable item.
3. Each place from the **current day** (label = place name, sets `placeId` + coords).
4. Each place from **other days** (grouped under "Other days") so users can anchor to their hotel even if it lives on day 1.
5. A free-text input at the bottom of the popover ("Use custom label…") that creates a `{ label }`-only `DayStartPoint` when submitted — same behavior as the old prompt but inline.

Implementation notes:
- Use existing `@/components/ui/command` + `@/components/ui/popover` (already part of shadcn setup; verify with `code--list_dir src/components/ui` and add via `bun add cmdk` if missing).
- Keep the trigger button styling identical to the current `Button` so layout is unchanged.
- Add i18n keys: `searchStartPoint`, `useCustomLabel`, `otherDays`.

## 3. Per-day mini map with ordered polyline

Create a small reusable component `src/components/DayMiniMap.tsx`:
- Lazy-loads `leaflet` (mirrors the pattern in `src/components/MapView.tsx`).
- Props: `places: Place[]`, `anchor: { lat: number; lng: number } | null`, `color: string`, `height?: string` (default `160px`).
- Draws:
  - A start marker (distinctive icon — small "S" pin) at `anchor` if present.
  - Numbered circle markers for each place in current order using `color`.
  - A `L.polyline` connecting `anchor → place1 → place2 → …` in order.
  - `fitBounds` over all points with a small padding.
- Re-renders when the places array reference changes (after reorder).

Embed it inside `DayRoutePanel` (or directly in `DaySection`, after `DayRoutePanel` and before the place list) so it sits between the route stats and the draggable place list. Use the day's `color` so it visually matches the day's legend dot.

If the day has fewer than 1 place and no anchor, render nothing.

---

## Technical summary (for engineers)

- **Files edited**: `src/lib/store.ts`, `src/lib/types.ts` (no shape change, just doc), `src/lib/i18n.ts`, `src/routes/itinerary.$id.tsx`, `src/server/plan-trip.functions.ts`.
- **Files created**: `src/components/DayMiniMap.tsx`, possibly `src/components/StartPointPicker.tsx` for the cmdk popover.
- **No DB / server changes** beyond echoing optional fields through server functions.
- **Risk**: persist version bump — keep `migrate` permissive (return state untouched if shape is fine) so existing trips load.

---

## Out of scope

- Real walking/transit routing via an external API (current estimate is haversine-based; mini map polyline will be straight lines, not snapped to streets).
- Persisting per-day settings to a remote DB.
