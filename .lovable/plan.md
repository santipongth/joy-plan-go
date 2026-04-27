# Core Budget Estimate — Enhancements

Five upgrades to `BudgetEstimate`: currency selector, per-day breakdown chart, info tooltip for paid attractions, hardened traveler validation, and confirmed persistence of preferences.

## What you'll see

1. **Currency selector** (THB / USD / EUR / JPY / GBP) sits next to the "Estimate" badge in the card header. Switching currency instantly reformats every number in the card and the new chart. Choice is remembered after refresh.
2. **Per-day breakdown chart** appears just under the totals. A compact stacked horizontal bar per day shows Stay / Attractions / Transportation portions with a legend, plus the day total. Bars scale to the largest day so days are visually comparable. Collapsible (default open) to keep the card compact.
3. **Info tooltip** — a small "i" icon next to the "Attractions" row. Hover/tap reveals the list of place types counted as paid attractions (museum, landmark, temple, zoo, etc.) plus the per-attraction rate, so the calculation is transparent.
4. **Travelers stepper validation** — typed/clamped to 1–20, +/- buttons disabled at limits (already partly implemented), plus an inline numeric input so users can type a value directly; out-of-range entries are clamped and a brief toast is shown.
5. **Persistence** — `budget`, `travelers`, and the new `currency` survive browser refresh.

## Technical details

### Currency
- New file `src/lib/currency-store.ts`: zustand-persist store holding `currency: "THB" | "USD" | "EUR" | "JPY" | "GBP"` (default `"USD"`) under key `budget-currency-v1`. Currency is a per-user preference, not per-itinerary, so it lives outside the itinerary store.
- New helper in `src/lib/budget.ts`:
  - `CURRENCIES` constant with `{code, symbol, rate}` (rates are static fallbacks relative to USD; e.g., THB 36, EUR 0.92, JPY 155, GBP 0.79).
  - Replace `formatUSD(n)` with `formatMoney(n, currency)` that converts USD → target currency and formats with `Intl.NumberFormat`. Keep a thin `formatUSD` re-export for any legacy callers.
- `BudgetEstimate.tsx` reads currency from the store and passes it to all formatters.

### Per-day breakdown chart
- Add `estimateBudgetByDay(itinerary, travelers, tier)` to `src/lib/budget.ts` that returns `Array<{ day: number; stay: number; attractions: number; transportation: number; total: number }>`. Reuses the existing per-category logic but scoped to one day:
  - Stay portion: `(nights/durationDays)` share allocated evenly across days, or 0 on the last day if we treat nights = days-1 (we'll spread evenly across `durationDays-1` nights and assign 0 to last day).
  - Attractions: count paid attractions in `day.places` only.
  - Transportation: that day's mode rate × travelers × tier multiplier; inter-city allowance is added to day 1 only.
- New component `src/components/BudgetByDayChart.tsx`: renders a list of rows, each with day label, a stacked bar (CSS flex with width % per category using brand colors that match the existing icons), and the per-day total formatted in the selected currency. Includes a small legend (color swatch + label) at the top.
- Inserted in `BudgetEstimate.tsx` directly under the totals block, inside a collapsible `<details>` with a "Per-day breakdown" summary so the card stays compact when not needed.

### Paid-attractions tooltip
- Export `PAID_ATTRACTION_TYPES` from `src/lib/budget.ts` (currently a local const).
- In `BudgetEstimate.tsx`, render an `Info` lucide icon next to the "Attractions" label wrapped in shadcn `Tooltip` (already available under `@/components/ui/tooltip`). Tooltip content lists the types (sorted, comma-separated) plus the line "≈ $15 per paid attraction per traveler (adjusted by tier)".

### Travelers validation
- In `BudgetEstimate.tsx`, replace the static span showing the count with a small `<input type="number" min={1} max={20}>` styled like the current span. On blur/Enter, clamp to `[1, 20]`; if user typed an out-of-range value, call `onTravelersChange(clamped)` and show `sonner` toast `t("travelersClamped")` ("Travelers must be between 1 and 20").
- Constants `MIN_TRAVELERS = 1`, `MAX_TRAVELERS = 20` exported from `src/lib/budget.ts` and reused by both stepper buttons and the input.

### Persistence
- `budget` and `travelers` are already saved through `update(id, { ... })` into the zustand-persisted itinerary store — no change needed; verified in `src/lib/store.ts`.
- `currency` persists via the new `currency-store.ts` (zustand `persist` middleware).

### i18n
Add to `src/lib/i18n.ts` (en + th):
- `currency`, `perDayBreakdown`, `paidAttractionsInfo`, `travelersClamped`, `day` (if missing).

### Files
- **Created**: `src/lib/currency-store.ts`, `src/components/BudgetByDayChart.tsx`
- **Edited**: `src/lib/budget.ts` (export types list, add `formatMoney`, `estimateBudgetByDay`, constants), `src/components/BudgetEstimate.tsx` (currency selector, tooltip, input validation, embed chart), `src/lib/i18n.ts` (new keys)
- **Unchanged**: `src/routes/itinerary.$id.tsx` — existing `update(id, { travelers })` / `update(id, { budget })` calls already persist via zustand.
