## Goals

1. Mini-map style toggle (streets / satellite / simplified).
2. Compact ordered-stops timeline under the mini map with per-leg minutes.
3. Full keyboard support for the start-point dropdown.
4. Toast-based "Undo" for place reorders within a few seconds.

---

## 1. Map style toggle (`src/components/DayMiniMap.tsx`)

- Add a new prop-less internal state `mapStyle: "streets" | "satellite" | "minimal"`, persisted globally via a tiny zustand store at `src/lib/map-style-store.ts` so the choice sticks across days/refresh.
- Define a `TILES` map:
  - `streets` → OSM `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.
  - `satellite` → Esri World Imagery `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
  - `minimal` → CartoDB Positron `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`.
- Replace the single `L.tileLayer(...).addTo(map)` with a `tileLayerRef` that we swap when `mapStyle` changes (remove old, add new). No need to recreate the map.
- Add a small floating control inside the map container (top-right, absolute, z-[400]) with three icon buttons (Map / Satellite / Layers icons from lucide). Style with existing tokens — `bg-background/90 backdrop-blur border rounded-md`. Each button tooltip = i18n label.

## 2. Compact stops timeline (under the mini map)

- Add `estimateLegMinutes(places, mode, anchor)` to `src/lib/route-utils.ts` (returns `number[]` where `legs[i]` is minutes to reach `places[i]`; `0` for the first when no anchor). Also export `modeProfile` so the component can reuse it.
- Render a new horizontally-scrolling row inside `DayRoutePanel` (after `DayMiniMap`):
  - Optional "S" chip when an anchor exists (start label, truncated).
  - For each place: a colored numbered chip with the place name (truncated to ~14 chars), separated by a `→` arrow that carries the leg's minutes (e.g. `↦ 12 min`).
  - When `effectiveMode === "any"`, show just the order without minutes.
- Use existing `color` prop. Use `overflow-x-auto whitespace-nowrap` so it never breaks layout.

## 3. Keyboard support for the start-point dropdown

cmdk's `Command` already handles ↑/↓/Enter when the `CommandInput` has focus. The current Popover loses input focus when items are clicked but doesn't fully wire the keyboard path:

- Set `<PopoverContent ... onOpenAutoFocus={(e) => { /* let cmdk auto-focus its input */ }}>` and ensure `<CommandInput autoFocus />`.
- Ensure each `<CommandItem>` uses `onSelect` (already true — keep). Items will then be Enter-selectable.
- Esc: Popover closes on Esc by default via Radix, but currently the input swallows it. Add `onKeyDown` on `CommandInput`: if `e.key === "Escape"`, call `setStartOpen(false)` and `e.stopPropagation()` so the Popover closes immediately even when the query is non-empty.
- Add a "use custom label" Enter shortcut: when the input has text and Enter is pressed but no item matched (CommandEmpty branch), trigger `chooseCustom`. Implement via `onKeyDown` on `CommandInput`: when `e.key === "Enter"` and the visible cmdk list has no selectable item, call `chooseCustom()`. Detect "no matches" via a small `onValueChange`-driven count (read from filtered groups manually) — simpler: check `commandRef.current?.querySelector('[cmdk-item][data-selected="true"]')`; if none, run `chooseCustom()`.

## 4. Undo for drag-and-drop reordering

- In `DaySection.handleDragEnd` (`src/routes/itinerary.$id.tsx`):
  - Snapshot `prev = day.places` before applying the new order.
  - Call `onReorder(arrayMove(...))` as today.
  - Show `toast.success(t("reordered"), { duration: 5000, action: { label: t("undo"), onClick: () => onReorder(prev) } })`.
- Apply the same undo pattern to the per-day "Update this day's order" button (snapshot before, undo on toast action) so the user can revert auto-optimised orders too.
- Add i18n keys: `reordered`, `undo`, `mapStyleStreets`, `mapStyleSatellite`, `mapStyleMinimal`, `mapStyleLabel`, `legMinutes`.

---

## Files

- **Edited**: `src/components/DayMiniMap.tsx`, `src/lib/route-utils.ts`, `src/lib/i18n.ts`, `src/routes/itinerary.$id.tsx`.
- **Created**: `src/lib/map-style-store.ts` (small zustand persist store for the chosen tile style).

## Out of scope

- Real per-leg routing (still haversine + mode profile).
- An undo stack — only the last reorder, via the toast action button (5 s window).
