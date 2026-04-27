# Plan

Three small, independent additions to the itinerary detail page (`src/routes/itinerary.$id.tsx`).

## 1. Toast after clicking "Undo (n)"

Today, clicking the day's Undo button quietly pops one history entry and shows a generic "Undo applied" toast. We'll change it so the toast tells you exactly how many reorder steps were undone for that day in this click — and how many remain.

- Capture the depth before pop, then show:
  - "Day {n}: undid 1 reorder step ({remaining} more available)"
  - When 0 remain: "Day {n}: undid 1 reorder step (no more to undo)"
- Same wording for the in-toast "Undo" action that fires from drag/drop and auto-reorder.

## 2. Confirm before regenerating a day with pending undo history

When you press "Regenerate day", if that day's undo stack is non-empty, we'll open a confirmation dialog first so reorder changes aren't silently wiped (regenerate already calls `clearHistory(id, dayIdx)`).

- Use the existing shadcn `AlertDialog` component.
- Title: "Regenerate Day {n}?"
- Body: "You have {n} unsaved reorder change(s) for this day. Regenerating will discard them and you won't be able to undo."
- Buttons: Cancel / Regenerate anyway (destructive style).
- If the stack is empty, regenerate runs immediately (current behavior).
- "Regenerate all" gets the same treatment if any day in the trip has undo history (single combined dialog listing affected day numbers).

## 3. "Core Budget Estimate" card

A new collapsible card inserted between the trip header (title + destination + days line) and the day legend.

Layout matches the reference image:

```text
┌─────────────────────────────────────────────────────┐
│ Core Budget Estimate                                │
│                                                     │
│ For the proposed itinerary and your budget, here    │
│ are the estimated expenses for {N} traveler(s)      │
│ going on a {D}-day trip departing {date}. Some      │
│ Attractions and Transportation prices are           │
│ unavailable at the moment. For up-to-date costs,    │
│ please confirm at the time of booking.              │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Total ({N} traveler)            ≈ US$X,XXX      │ │
│ │ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱                          │ │
│ │ 🚆 Transportation                    US$2,590    │ │
│ │ 🏔  Attractions                      US$120      │ │
│ │ 🛏  Stay                             US$70       │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Inputs
- `travelers` (default 1) — small +/- stepper next to the total.
- `budget` tier already saved on the trip (low/medium/high). If missing, default to medium.
- `durationDays`, `startDate`, places per day, and travel mode all come from the existing itinerary.

### How the estimate is calculated (transparent heuristic, no external API)
Per-traveler per-day base rates, scaled by budget tier (low ×0.6, medium ×1.0, high ×1.8):

- **Stay**: base $35/night/traveler · (days − 1), min 0.
- **Attractions**: $15 × number of places that look like paid attractions (type in: museum, attraction, landmark, park-with-fee, theme, tour, show), per traveler.
- **Transportation**: weighted by the day's travel mode — walking $5/day, transit $15/day, mixed $25/day, "any" $30/day, all per traveler. Plus a flat one-time inter-city allowance of $200 × travelers if `origin` differs from `destination`.

Numbers shown rounded to the nearest $5; total is the sum. The progress bar fills `total / (high-tier total)` so users can visually see where they sit on the budget spectrum.

### UX details
- Card uses existing `Card` component, same border/background as the day legend block.
- Three rows: Transportation (Train icon), Attractions (Mountain icon), Stay (Bed icon) — all from `lucide-react`.
- Right-aligned monetary values, tabular-nums.
- Tiny "Estimate" badge in header to set expectations.
- All strings go through the i18n dictionary (Thai + English keys added to `src/lib/i18n.ts`).
- Currency: USD only for now (matches reference); formatted as `US$X,XXX`.

## Files

- `src/routes/itinerary.$id.tsx` — modify undo handlers (toast wording), wrap regenerate calls in AlertDialog, render the new budget card.
- `src/components/BudgetEstimate.tsx` — new component containing the card, calculator, and travelers stepper.
- `src/lib/budget.ts` — new pure helper exporting `estimateBudget(itinerary, travelers, tier)` returning `{ total, transportation, attractions, stay, maxScale }`. Easy to unit test later.
- `src/lib/i18n.ts` — add keys: `coreBudgetEstimate`, `budgetIntro`, `total`, `transportation`, `attractions`, `stay`, `estimate`, `traveler`, `travelers`, `undidNStepsRemaining`, `undidNStepsNoMore`, `regenConfirmTitle`, `regenConfirmBody`, `regenConfirmAction`, `regenAllConfirmBody`, `cancel`.
- `src/lib/types.ts` — add optional `budget?: "low" | "medium" | "high"` and `travelers?: number` to `Itinerary` (persisted via existing zustand store; both optional so existing trips stay valid).

## Out of scope

- Real pricing APIs (Skyscanner / Booking / GetYourGuide). The card is clearly labeled as an estimate.
- Currency switching — USD only for now.
- Per-day budget breakdown — only the trip-wide totals shown in the reference.
