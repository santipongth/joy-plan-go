## Inline Day Errors, Print Headers/Footers, Regen ETA

### 1. Per-day inline error during full-trip regeneration

The inline `Alert` with day-specific Retry already exists in `DaySection` (driven by `regenErrors[day]`). Currently `regenerateAll` aborts the loop on the first failure. Change it so a per-day failure is recorded into `regenErrors` and the loop continues — so the user sees a red banner exactly on the failed day with a Retry button that only re-runs that day via the existing `regenerateDay(dayIdx)`.

**`src/routes/itinerary.$id.tsx` → inside `regenerateAll()` per-day loop:**
- On `dayRes.error || !dayRes.day`:
  - `setRegenErrors(prev => ({ ...prev, [target.day]: msg }))`
  - Show a small toast `"Day {n}: {msg}"` (no global "regenFailed" abort).
  - `continue;` — do NOT `return`.
- After the loop, if any errors remain, show one summary toast: `"Some days failed — retry from each day"`. Otherwise the existing `regenAllSuccess` toast.
- The existing inline `Alert` already calls `onRegenerate={() => regenerateDay(dayIdx)}` which only regenerates that single day — no change needed in `DaySection`.

### 2. Estimated time remaining during full-trip regeneration

Track wall-clock elapsed time and project the remainder from average per-day time.

**`src/routes/itinerary.$id.tsx`:**
- Extend progress state: `regenAllProgress: { current: number; total: number; startedAt: number; etaSec: number | null } | null`.
- Set `startedAt = Date.now()` when starting; `etaSec = null` initially.
- After each successful `replaceDay` in the loop:
  - `const elapsed = (Date.now() - startedAt) / 1000;`
  - `const avg = elapsed / current;`
  - `const etaSec = Math.max(0, Math.round(avg * (total - current)));`
  - `setRegenAllProgress({ current, total, startedAt, etaSec });`
- In the header progress bar UI, show ETA next to the percent: `"Day 2 / 5  ·  ~14s left  ·  40%"`. Hide ETA until at least one day has finished (when `etaSec !== null`).
- New i18n keys: `timeLeft` (`"เหลือประมาณ"` / `"~"`), `seconds` (`"วิ"` / `"s left"`).

### 3. Repeating print headers and footers

Add running headers (trip title + dates) and footers (page number) on every printed page using CSS `@page` margin boxes and `string-set`. Browsers that don't support margin boxes (Firefox) gracefully print without them — no broken layout.

**`src/styles.css` (`@media print`):**
- Define page margin boxes:
  ```css
  @page {
    size: A4;
    margin: 22mm 18mm 20mm 18mm;
    @top-left   { content: string(trip-title); font: 10px ui-sans-serif; color: #555; }
    @top-right  { content: string(trip-meta);  font: 10px ui-sans-serif; color: #555; }
    @bottom-right { content: "Page " counter(page) " / " counter(pages); font: 10px ui-sans-serif; color: #555; }
    @bottom-left  { content: string(trip-title); font: 10px ui-sans-serif; color: #999; }
  }
  ```
- Make the cover set the running strings:
  ```css
  .print-cover h1 { string-set: trip-title content(); }
  .print-cover .print-meta-running { string-set: trip-meta content(); }
  ```
- Add a hidden-on-screen, top-of-page running line so non-supporting browsers still get inline context (e.g. show as a small repeated header above each `.print-day` via a `position: fixed; top: 0;` strip is unreliable across browsers, so we rely on `@page` margin boxes for the repeat — fallback is just the per-day section header which remains).

**`src/components/PrintItinerary.tsx`:**
- Add a single concise meta line on the cover used for `string-set: trip-meta`:
  ```tsx
  <p className="print-meta print-meta-running">
    {itinerary.destination}
    {itinerary.startDate ? ` · ${itinerary.startDate}` : ""}
    {` · ${itinerary.durationDays} ${t("days")}`}
  </p>
  ```
- No structural changes; the cover heading already sets the title via `string-set`.

### Files touched

- `src/routes/itinerary.$id.tsx` — continue-on-error loop, ETA state and display
- `src/lib/i18n.ts` — `timeLeft`, `seconds`, `page` keys
- `src/styles.css` — `@page` margin boxes with `string-set` and page counters
- `src/components/PrintItinerary.tsx` — class on cover meta line for `string-set`

### Technical notes

- ETA is recomputed after each successful day, so it self-corrects if early days are faster/slower. Skipped (failed) days don't contribute to the average — we only divide by *successful* completions to keep estimates honest.
- `@page` margin boxes are widely supported in Chrome/Edge/Safari for print. Firefox ignores them; printout still works, just without the running header/footer. No JS polyfill needed.
- `string-set` on `.print-cover h1` captures the trip title once; `counter(page)/counter(pages)` is automatic.
