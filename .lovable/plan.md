# Print, Page-Break, Visibility Reset & Alert Dismiss

## 1. Per-day automatic page breaks (no awkward splits)

Update `src/styles.css` `@media print` block:
- Keep `.print-day { page-break-inside: avoid; break-inside: avoid; }` so a short day stays on one page
- Add `.print-places, .print-places tr, .print-places td, .print-places th { page-break-inside: avoid; break-inside: avoid; }` so individual rows never split mid-cell
- Add `.print-places thead { display: table-header-group; }` so the header repeats on each page when a long day's table does need to flow
- Keep the explicit `page-break-after: always` between days (already inline in `PrintItinerary.tsx`) but switch to CSS-driven: `.print-day + .print-day { page-break-before: always; }` — cleaner and removes the inline style decision in the component

Update `src/components/PrintItinerary.tsx`:
- Remove the inline `pageBreakAfter` style and let CSS handle it
- Wrap each day's content in a `print-day-body` div so we can mark `page-break-inside: avoid` on the header+first-rows pair as a unit, while still allowing very long tables to break between rows

## 2. Reset visible days to "all" on full-trip regeneration

Currently there's no "regenerate full itinerary" UI — only single-day. Add it.

In `src/routes/itinerary.$id.tsx`:
- Import `planTrip` server fn and `useServerFn`
- Add new `regenerateAllLoading` boolean state
- Add `regenerateAll()` async function:
  - `confirm(t("confirmRegenAll"))` first
  - Calls `planTrip` with the same destination/origin/durationDays/etc the itinerary was created with
  - Maps result to `DayPlan[]` (new place ids), updates itinerary via `update(id, { title, citiesCount, days })`
  - Clears all `regenErrors`
  - **Resets visibility**: `setVisible(id, newDays.map(d => d.day))`
  - Same error mapping (RATE_LIMIT/PAYMENT_REQUIRED/AI_ERROR) with toast + retry action
- Add a "Regenerate full trip" button in the header (next to Export)

Also in `useEffect` that initializes visibility:
- Currently runs only when `visibleArr === undefined`
- Add a second effect: detect when the **set of day numbers changes** (e.g. itinerary day count went from 3 → 5). Compare current `visibleArr` against `itinerary.days.map(d => d.day)`. If saved set references days that no longer exist, or the itinerary has new days not in the saved set, call `setVisible(id, allDays)` to reset cleanly. This makes the reset robust whether triggered by the new button, by the home page recreating, or by future flows.

## 3. Dismiss button on inline error alert

In `src/routes/itinerary.$id.tsx`:
- Add `clearRegenError(day: number)` helper that removes the key from `regenErrors`
- Successful retry already clears it (existing code in `regenerateDay`)
- In `DaySection`, accept new `onDismissError?: () => void` prop
- In the `<Alert>`, add an `X` icon button on the right that calls `onDismissError`
- Wire it from parent: `onDismissError={() => clearRegenError(d.day)}`

## 4. Dedicated "Print itinerary" button

In `src/routes/itinerary.$id.tsx` header:
- Add a separate `<Button>` next to the Export dropdown:
  - Icon: `Printer` from lucide-react
  - Label: `t("print")`
  - `onClick={() => window.print()}`
- The print stylesheet already hides everything except `PrintItinerary` (`.print:hidden` on screen layout, `.hidden print:block` on print layout), so the button itself is automatically hidden during print preview — no extra work needed.
- Keep the existing "Download PDF" item in the Export dropdown for discoverability (it does the same thing but framed for PDF export).

## i18n keys (TH + EN) added to `src/lib/i18n.ts`

`regenerateAll`, `regeneratingAll`, `confirmRegenAll`, `print`, `dismiss`

## Files Changed

- `src/styles.css` — strengthened print page-break rules
- `src/components/PrintItinerary.tsx` — remove inline page-break, rely on CSS
- `src/lib/i18n.ts` — new keys (TH/EN)
- `src/routes/itinerary.$id.tsx` — Print button, Regenerate full trip flow, visibility reset effect, alert dismiss button
