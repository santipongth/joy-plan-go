## Refinements: Regen Progress, Print Polish, Error UX

Three focused improvements to the itinerary view.

### 1. Full-trip regenerate: progress indicator with current day

The current `regenerateAll` only shows a spinner with no per-day feedback. We'll switch from one batch `planTrip` call to a sequential per-day loop using the existing `planSingleDay` server function so we can surface progress.

**`src/routes/itinerary.$id.tsx`**
- Replace `regenAllLoading: boolean` with state `regenAllProgress: { current: number; total: number } | null`.
- In `regenerateAll()`:
  - First call `planTripFn` (kept) to get the trip title + day count + initial structure (so we still get a coherent title).
  - Then iterate `for (let i = 0; i < res.days.length; i++)` calling `planSingleDay` per day (passing the running summary), updating `regenAllProgress = { current: i+1, total }` before each call, and committing each day via `replaceDay` as it arrives. This produces a streaming "Day X of N" feel.
  - Reset visibility to all days at the end (already done).
  - On any single-day failure: stop, surface a toast with retry, leave already-completed days in place.
- In the header button, show:
  - Idle: `Wand2` + "Regenerate full trip"
  - In progress: `Loader2 spin` + `"Regenerating day {current} / {total}..."`
- Add a thin progress bar under the header (a simple `<div>` with width `(current/total)*100%`) visible only while `regenAllProgress` is set.

**`src/lib/i18n.ts`** — add keys:
- `regeneratingDay` — `"กำลังสร้างวัน {n} จาก {total}..."` / `"Generating day {n} of {total}..."` (we'll do a tiny inline replace in the component).

### 2. Print layout: consistent spacing, no border overlap across pages

Current CSS forces `page-break-before: always` between every day, which works but tables can still bleed. Tighten the rules.

**`src/styles.css`** (`@media print` block)
- Add `border-spacing: 0` and `box-sizing: border-box` to `.print-places`.
- Change `.print-day + .print-day` to keep the forced `break-before: page` but standardize top spacing: set `padding-top: 0` and `margin-top: 0` consistently; first day gets `margin-top: 0` too.
- Add `.print-day { padding-bottom: 12px; }` so the last row's bottom border doesn't kiss the page edge.
- Replace the `border: 1px solid` strategy on `td/th` with a half-border approach to prevent doubled borders at page-break rows: keep `border-bottom` and `border-right` only on cells, plus a wrapping `border-top` and `border-left` on the table itself. This eliminates the visual "double line" when a row sits at the top of a new page.
- Add `.print-places tbody tr { break-inside: avoid; page-break-inside: avoid; }` (already present) and additionally `.print-places tr + tr td { border-top: 0; }` — guard against accidental top borders.
- Add `.print-day-header { break-after: avoid-page; }` so the day header never gets orphaned at the bottom of a page above its table.

**`src/components/PrintItinerary.tsx`** — no structural changes; the CSS does the work.

### 3. Day error: only clear on successful retry, with confirmation toast

Today, `regenerateDay` shows a generic `toast.success("✓")` and clears the error inside `replaceDay` flow. We'll make the success path explicit and only clear the inline `Alert` after the regenerate truly succeeded.

**`src/routes/itinerary.$id.tsx` → `regenerateDay()`**
- Remove the existing optimistic clear behavior (currently it does happen only on success, which is correct — but the dismiss button also clears it manually; we'll keep that behavior intact).
- After a successful `replaceDay`, replace `toast.success("✓")` with a descriptive confirmation toast using new i18n key `regenSuccess`: `"สร้างวัน {n} ใหม่สำเร็จ"` / `"Day {n} regenerated successfully"`.
- On failure path: do NOT touch `regenErrors` for that day (leave the previous error visible if there was one) — currently we only set, which is fine. Just confirm we never clear on click.
- Ensure the inline `Alert`'s "Retry" button calls `regenerateDay(dayIdx)` and the alert remains until that call resolves successfully (driven by `regenErrors` state already).

**`src/lib/i18n.ts`** — add keys:
- `regenSuccess` — `"สร้างวัน {n} ใหม่สำเร็จ"` / `"Day {n} regenerated successfully"`.

### Technical notes

- Inline string interpolation: since `useT()` returns plain strings, do `t("regeneratingDay").replace("{n}", String(current)).replace("{total}", String(total))` at the call site — keeps the i18n module unchanged in shape.
- Sequential `planSingleDay` calls in `regenerateAll` increase total wall time but give visible progress, which is the goal. Each call uses the running summary of already-completed days to avoid duplicates.
- Print border fix uses the standard "collapsed-borders via per-side strategy" pattern; no new dependencies.

### Files touched

- `src/routes/itinerary.$id.tsx` — progress state, sequential regen loop, progress bar, success toast wording
- `src/lib/i18n.ts` — `regeneratingDay`, `regenSuccess`
- `src/styles.css` — refined `@media print` rules for spacing and borders
