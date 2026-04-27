## Scope

Three improvements to the **itinerary detail page** (`src/routes/itinerary.$id.tsx`) and **server prompt** (`src/server/preferences-prompt.ts` + `plan-trip.functions.ts`).

---

### 1. Click-to-highlight: link summary categories to map markers

The detail page already has a left panel (days + places) and a right map. Add a **category filter chip bar** above the map that, when clicked, highlights matching markers.

**Categories** (derived from `place.type` field returned by AI: landmark, food, nature, shopping, culture, nightlife, hotel):
- Render chips with counts for each type present in the trip
- Plus an "All" chip and per-day chips already exist via visibility store
- Clicking a type chip sets `highlightedType` state passed to `MapView`

**MapView changes** (`src/components/MapView.tsx`):
- New optional prop `highlightedType?: string | null`
- When set, markers whose `place.type !== highlightedType` render with `opacity:0.25` and smaller (24px); matching ones get a pulse ring (CSS animation `@keyframes pulse-ring` added to `src/styles.css`)
- Polylines fade similarly
- Clicking a marker continues to fly-to + open popup
- Add a `selectedPlaceId` prop too: when a list item on the left is clicked, the matching marker opens its popup and the map pans to it

**Detail page changes**:
- Click a place row in the day list → setSelectedPlaceId → map pans/opens popup
- Add a small floating chip toolbar above the map area with type filters

### 2. Per-day editing: swap places between days

Per-day **regenerate**, **remove**, and **add** are already implemented. Add the missing piece: **move/swap a place to another day**.

- New store action `movePlace(id, fromDayIdx, toDayIdx, placeId)` in `src/lib/store.ts`
- In each place row, add a small "Move to day…" dropdown (DropdownMenu) listing the other days; selecting one moves the place
- Show a brief toast on success
- Drag-and-drop across days is out of scope (current dnd-kit setup is per-day vertical sortable); a dropdown action is simpler and consistent with mobile UX
- Add i18n keys: `moveToDay`, `moveDayPrompt`, `moveSuccess`

### 3. Server-side cross-day dedupe by lat/lng similarity

In `src/server/plan-trip.functions.ts`, after the AI returns `parsed.days`, post-process:

- Helper `dedupePlacesAcrossDays(days)`:
  - Iterate every place across days in order
  - For each place, check if any prior accepted place is "similar":
    - Distance via Haversine ≤ **150 m**, OR
    - Normalized name match (lowercase, strip punctuation, collapse spaces) equals a prior name
  - If duplicate: drop it (keep first occurrence)
  - If a day ends up with < 2 places after dedupe, that's acceptable (frontend can show a warning); we do not synthesize replacements in this round
- Apply the same dedupe in `planSingleDay` against the `existingDaysSummary` — extend `PlanDayInput` to optionally accept `existingPlaces?: { name: string; lat: number; lng: number }[]` and after AI returns, drop any returned place that matches one
- Update `regenerateDay`/`regenerateAll` callers in `src/routes/itinerary.$id.tsx` to pass `existingPlaces` (computed from the other days' places)
- Strengthen the prompt with: `"Avoid revisiting any place from other days. Each place must be a unique location (distinct name AND coordinates more than ~200m apart from any other day's place)."`

Helper `haversineMeters(a, b)` and `normalizeName(s)` placed in a new file `src/server/dedupe.ts`.

## Files to edit

- `src/routes/itinerary.$id.tsx` — type filter chips, place click → map focus, "Move to day" dropdown, pass `existingPlaces` to regen
- `src/components/MapView.tsx` — `highlightedType`, `selectedPlaceId` props, fade non-matching markers
- `src/styles.css` — pulse-ring animation
- `src/lib/store.ts` — `movePlace` action
- `src/lib/i18n.ts` — `moveToDay`, `moveSuccess`, `filterByType`, `allTypes`
- `src/server/dedupe.ts` (new) — haversine + name normalization
- `src/server/plan-trip.functions.ts` — apply dedupe post-AI for both functions; extend `PlanDayInput` with `existingPlaces`; tighten prompt
