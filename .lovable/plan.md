# Plan — 5 New Features

Implement five enhancements to the trip planner. All work happens after plan approval.

---

## A. "AI Suggest" mode — refine an existing trip per day

A new button **"AI Suggest"** opens a dialog where the user picks **Budget**, **Travel time per day** (short / balanced / long), and **Style** chips (relaxing / sightseeing / foodie / adventurous / shopping…). The AI then rewrites each day's `places` array, respecting current places when possible and producing a coherent, time-ordered plan. Each suggested place keeps `lat/lng` so map pins update automatically and clicking a place in the day list flies the map to its pin.

**Where it appears**: Itinerary header (`/itinerary/$id`), next to "Regenerate all".

**Behavior**:
- Modal collects preferences, shows current day count, lets user choose "all days" or one specific day.
- Calls a new server function `aiSuggestPlan` (Lovable AI Gateway, `gemini-3-flash-preview`, tool-calling for strict JSON).
- On success, replaces the targeted day(s) via the existing `replaceDay` store action so undo/history still works.
- Each place card already shows on the map; we add a small "Show on map" pin button that scrolls the right panel and pulses the marker.

---

## B. Weather anchor picker

`WeatherStrip` currently auto-picks the first place with coordinates. Add a small **dropdown selector** above the strip listing every place in the trip (grouped by day, "Day 1 · Wat Pho", etc.) plus an **"Auto (first place)"** option. Selection persists per itinerary in `localStorage` (key includes itinerary id). The forecast refetches when the anchor changes.

---

## C. Real dates in WeatherStrip

Each card currently shows "Day 1 / Day 2…". Change to localized real dates derived from `itinerary.startDate + i` using `date-fns` `format`:
- Thai: `"12 เม.ย."` (`d MMM` with `th` locale)
- English: `"Apr 12"` (`MMM d`)

Day number remains visible as a small subtitle ("Day 1") so context is preserved. Falls back to "Day N" when `startDate` is missing.

---

## D. Photo gallery per trip/day with AI captioning

Add a per-day photo strip + a "Trip gallery" section. Photos upload to Supabase Storage; AI auto-suggests a caption using the Lovable AI Gateway (image input → text).

**Storage**: New public bucket `trip-photos` with RLS so only the trip owner / collaborators can upload, but anyone can read (so public trips display photos).

**Schema**: New `trip_photos` table:
- `id uuid pk`, `trip_id uuid fk → trips.id`, `owner_id uuid`, `day_index int null` (null = trip-level), `storage_path text`, `caption text`, `created_at`.
- RLS:
  - `SELECT`: trip owner, collaborators, OR trip is public.
  - `INSERT/UPDATE/DELETE`: trip owner OR collaborator.

**Server function** `captionPhoto`: takes a public image URL, returns a 1-sentence caption (Thai or English).

**UI**:
- New `PhotoGallery.tsx` component embedded in each day (compact horizontal strip with "+ Add photo" tile) and a "Trip Gallery" card in the sidebar.
- Lightbox on click (existing `Dialog`).
- Upload flow: pick file → upload to bucket under `<trip_id>/<uuid>.jpg` → insert row → call `captionPhoto` → patch `caption`.
- Photos only show when the user is signed in AND the trip exists in the cloud (we already auto-push via ShareTripDialog; we add the same `pushTrip` ensure step inside the gallery upload handler).

---

## E. Trip card badges (Public / Shared with me)

On the home page card grid, show small badges beneath the title:
- **"Public"** (Globe icon) — when the cloud copy of this trip has `is_public = true` and the user is the owner.
- **"Shared with me"** (Users icon) — when the trip belongs to another user but appears via `trip_collaborators`.

**Wiring**: On home mount (when signed in) we already have access to `useAuth`. Fetch the user's cloud trips with `fetchMyTrips(user.id)` once and build a map keyed by `client_id`:
```
{ [client_id]: { isPublic: boolean, isShared: boolean } }
```
Render the badge from that map; cards without a cloud match show no badge.

For trips that exist only in the shared list (not in local store yet), also show them in the grid as "cloud-only" cards, opening them via their `client_id`.

---

## Technical Notes

**New / changed files**

| File | Purpose |
|---|---|
| `src/server/discover.functions.ts` | Add `aiSuggestPlan` and `captionPhoto` server fns |
| `src/components/AISuggestDialog.tsx` | Feature A modal |
| `src/components/WeatherStrip.tsx` | Add anchor picker + real dates |
| `src/lib/weather-anchor-store.ts` | Per-trip anchor preference (zustand + localStorage) |
| `src/components/PhotoGallery.tsx` | Feature D component |
| `src/lib/photos.ts` | Upload + list + caption helpers |
| `src/lib/cloud-sync.ts` | Add `fetchMyTripsBadges` helper |
| `src/routes/index.tsx` | Render badges on cards |
| `src/routes/itinerary.$id.tsx` | Mount AISuggestDialog + PhotoGallery |
| `src/lib/i18n.ts` | New keys (suggest, gallery, badges, weather anchor) |
| Supabase migration | `trip-photos` bucket + `trip_photos` table + RLS |

**Map pin link** (Feature A): we expose a small zustand store `useFocusedPlaceStore` with `setFocused(placeId)`. `MapView` listens and animates `flyTo` + pulses the marker. Place cards get a tiny map-pin button.

**AI captioning approach**: upload first → get public URL via `supabase.storage.from('trip-photos').getPublicUrl()` → server fn fetches the image and sends it as `image_url` content to Gemini Flash with a short instruction. Caption is editable inline.

**No breaking changes** to existing data shape. New fields are additive and optional.

---

## Out of scope
- Photo reordering / albums.
- AI suggestions that re-fetch external place metadata (we trust the model's lat/lng like existing flows).
- Translating photo captions on language change (caption is generated in current UI language at upload time).