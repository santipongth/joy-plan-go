## Goals

1. Make sure the selected start point — including its `lat`, `lng`, and `placeId` — survives both AI regeneration and a browser refresh.
2. Make the per-day mini map well-behaved: gestures don't hijack page scroll, and Leaflet instances are torn down properly when routes change.
3. Make the start-point dropdown feel instant by memoizing/caching the per-day route stats and the dropdown's option list.

---

## 1. Robust start-point persistence

Today the store persists `startPoint`, but two gaps remain:

- **AI regeneration replaces a day's `places` with brand-new IDs.** If the user chose a start point that points to a place via `placeId`, the ID becomes stale on regen and `resolveAnchor` falls through to the stored `lat`/`lng` (works), but if no lat/lng was stored, the anchor silently breaks.
- **Old persisted data from before per-day start points** may have `startPoint` shapes without lat/lng.

Fixes in `src/lib/store.ts`:

- In `replaceDay`, when the AI returns a new day:
  - If the new day has its own `startPoint`, keep it.
  - Otherwise, take the previous `startPoint` and try to **remap `placeId`** to the new place list by matching on place `name`. If matched, write the new `placeId` plus its `lat`/`lng` and the original label.
  - If no match, fall back to the previously stored `lat`/`lng` (drop the stale `placeId`) so the anchor still works.
  - As a last resort, keep just the `label` (still a useful display anchor).
- Bump persist `version: 3` with a migrate that, for any `startPoint` having a `placeId`, fills in `lat`/`lng` from the matching place in that day if currently missing.

In `src/routes/itinerary.$id.tsx` (the start picker `choosePlace`), the option already writes `{ label, lat, lng, placeId }` — verify this stays the case for places picked from *other* days too (it currently does, since we pass the same `Place` object).

## 2. Mini map gesture + lifecycle hardening

In `src/components/DayMiniMap.tsx`:

- Map options:
  - `scrollWheelZoom: false` (already set).
  - Add `touchZoom: false` and `doubleClickZoom: false` so two-finger gestures and double-tap zoom don't fight scroll on mobile.
  - Keep `dragging: true` but set `inertia: false` and `keyboard: false` to avoid the map stealing keyboard focus.
  - Stop wheel events from bubbling so scrolling over the map continues to scroll the page (delegate via `L.DomEvent.disableScrollPropagation` on the container, NOT `disableClickPropagation`, so clicks still work).
- Lifecycle cleanup:
  - In the unmount cleanup function, call `mapRef.current?.remove()` and null out `mapRef`, `layerRef`, `LRef`. Today the map is never destroyed — switching itineraries leaks DOM listeners and Leaflet instances and can cause "Map container is already initialized" on re-mount.
  - Also remove the previous `featureGroup` before adding a new one (already done) but use `map.eachLayer` as a defensive reset if the cached `layerRef` ever gets out of sync.
- Resize: when the parent container changes size (e.g. opening/closing collapsibles), call `map.invalidateSize()` after a microtask. Use a `ResizeObserver` on the container so the map keeps the right viewport.

## 3. Memoize/cache the heavy per-day work

In `src/routes/itinerary.$id.tsx` `DayRoutePanel`:

- Wrap `resolveAnchor(day.startPoint, day.places)` and `estimateDayTravel(day.places, effectiveMode, anchor)` in `useMemo` keyed by `[day.places, day.startPoint, effectiveMode]`.
- Wrap `otherDayPlaces` in `useMemo` keyed by `[allDays, dayIdx]`.
- Compute `startLabel` and `reasoning` from the memoized values so they don't recompute on every parent re-render (e.g., regen toasts).

In `src/lib/route-utils.ts`:

- Add a small **module-level WeakMap cache** keyed by the `places` array reference for `estimateDayTravel`. Cache value is `Map<modeKey + anchorKey, DayTravelEstimate>`. This means as long as the user only flips travel mode or start point, no re-walks happen on subsequent renders for the same place list.
- Same idea for `reorderPlacesFromAnchor` — cache by `[places ref, mode, anchorKey]` so repeatedly clicking "update day order" with no changes is a no-op.

Debouncing:

- The dropdown itself doesn't run heavy work, but selecting a start point triggers an immediate store write + re-render of all days. Add a 120ms debounce around `setDayStart` writes inside `DayRoutePanel` so rapid keyboard navigation through cmdk options doesn't thrash the store. Use a small `useDebouncedCallback` helper inline (no new dep) — `useRef<NodeJS.Timeout>` + `useEffect` cleanup.

---

## Technical summary

- **Files edited**: `src/lib/store.ts`, `src/lib/route-utils.ts`, `src/routes/itinerary.$id.tsx`, `src/components/DayMiniMap.tsx`.
- **No new packages**, no DB changes.
- **Persist version**: bump to `3` with a migrate that backfills `lat`/`lng` on `startPoint`s referencing a placeId.
- **Risk**: WeakMap cache keys on the `places` array reference — Zustand returns new arrays on every update, so cache entries naturally GC. No stale data risk.

## Out of scope

- Real routing API (still straight-line polylines).
- Server-side persistence of itineraries (still localStorage only).
