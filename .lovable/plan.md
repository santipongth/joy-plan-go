# Itinerary Enhancements Plan

Several requested items are already implemented (DnD reordering, day color legends in header + map, show/hide toggle filtering markers + polylines). This plan focuses on the genuinely new work.

## 1. Persist day show/hide toggles in localStorage

In `src/lib/store.ts`, add a new persisted slice for per-itinerary visible-day sets:
- New state shape: `visibleDaysByItinerary: Record<string, number[]>`
- Actions: `setVisibleDays(itineraryId, days[])`, `toggleVisibleDay(itineraryId, day)`
- Use a separate `persist` store (`trip-planner-visibility`) so it doesn't bloat the itineraries store

In `src/routes/itinerary.$id.tsx`:
- Replace local `useState<Set<number>>` with the persisted store
- On first load for an itinerary with no saved entry → default to all days visible
- All `toggleDay` / `showAllDays` calls write through the store

## 2. Click day legend item on the map to toggle that day

The header legend already toggles. Update the floating map legend in `itinerary.$id.tsx` (lines ~369-389):
- Show ALL days (not just visible ones) so users can re-enable hidden ones
- Make each row a `<button>` calling `toggleDay(d.day)`
- Apply opacity/strikethrough styling for hidden days, matching header chips
- Add a small Eye/EyeOff icon for clarity

## 3. Detailed regenerate-day error messages with retry

Currently `regenerateDay` shows a single generic `t("aiError")` toast. Improve it:

In `itinerary.$id.tsx`:
- Track last failed day index in state: `lastFailedRegen: number | null`
- Map server error codes to specific messages:
  - `RATE_LIMIT` → `t("rateLimit")` (already in dict)
  - `PAYMENT_REQUIRED` → `t("paymentRequired")` (already in dict)
  - `AI_ERROR` / `EXCEPTION` / `NO_TOOL_CALL` → `t("aiError")`
- Use `toast.error(message, { action: { label: t("retry"), onClick: () => regenerateDay(dayIdx) }, duration: 10000 })`
- Add `retry` key to `src/lib/i18n.ts` (TH: "ลองอีกครั้ง", EN: "Retry")
- Also surface inline retry: when a day's last regen failed, show a small inline alert above the day's places with a Retry button

## 4. Dedicated PDF/print itinerary layout

Currently `exportPdf()` just calls `window.print()` and relies on `print:hidden` classes, which still prints the live screen layout awkwardly.

Approach: render a hidden print-only view that's optimized for paper.

- Create `src/components/PrintItinerary.tsx`:
  - Receives `itinerary` prop
  - Renders: cover header (title, destination, dates, day count), then per-day section with day title, color bar, table-like list of places (#, time, name, description, coords)
  - No map, no buttons, no sidebar
  - Uses `break-inside-avoid` on each day section and `break-after-page` between days for clean page breaks
- In `itinerary.$id.tsx`:
  - Render `<PrintItinerary />` inside a `<div className="hidden print:block">`
  - Wrap the existing screen layout grid in `print:hidden`
  - `exportPdf()` still calls `window.print()` — browser's native "Save as PDF" produces the clean layout
- Add `@media print` rules in `src/styles.css`:
  - `@page { margin: 18mm; size: A4; }`
  - Force background colors (`-webkit-print-color-adjust: exact`)
  - Day color bars/dots remain colored

## Technical Notes

- No new dependencies needed — all DnD, leaflet, dnd-kit, sonner already installed.
- `toast.error` with `action` is supported by sonner.
- Keep the visibility store keyed by itinerary id so different trips remember independently.
- Skipping items already implemented: drag-and-drop reordering (done via @dnd-kit), show/hide map filtering (groups already filtered by visibleDays), color legends header + map.

## Files Changed

- `src/lib/store.ts` — add visibility persistence slice (or new sibling store)
- `src/lib/i18n.ts` — add `retry`, `regenFailed`, print-layout strings (TH + EN)
- `src/routes/itinerary.$id.tsx` — wire visibility store, error mapping with retry action, click-to-toggle map legend, mount PrintItinerary
- `src/components/PrintItinerary.tsx` — new dedicated print layout
- `src/styles.css` — `@page` rules + print color adjustments
