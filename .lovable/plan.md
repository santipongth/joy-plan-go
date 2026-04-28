
# แผนปรับปรุง "แนะนำมื้ออาหาร" (A + B + ส่วนเสริม)

## ภาพรวม

แทนที่ปุ่ม "🍴 แนะนำมื้ออาหาร" ตัวเดิมที่ยัดร้านเข้า timeline ทันที ด้วย 2 จุดเข้า:
1. **Dialog แบบ Configure → Preview → Apply** (จุดเข้าหลัก ในแถบ action ของแต่ละวัน)
2. **Inline Meal Slot** (dashed card ในไทม์ไลน์ตรง gap เวลาอาหาร — discoverable)

พร้อม context-aware, MealCard, persist preference, replace action และ empty state banner

---

## 1. Data model (`src/lib/types.ts`)

เพิ่ม field ใหม่ใน `Place` (สำหรับ meal โดยเฉพาะ):
```ts
export interface Place {
  // ...เดิม
  cuisine?: string;        // เช่น "thai", "japanese", "cafe"
  priceRange?: "$" | "$$" | "$$$";
  rating?: number;         // 0-5
  openHours?: string;      // เช่น "10:00-22:00"
  imageUrl?: string;       // Unsplash placeholder
}
```

เพิ่ม type ใหม่:
```ts
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPreferences {
  cuisines?: string[];          // ["thai","street","cafe"]
  diet?: ("vegetarian" | "vegan" | "halal" | "gluten-free")[];
  priceTier?: BudgetTier;
  avoidIngredients?: string[];
}
```

เพิ่มใน `Itinerary`:
```ts
mealPreferences?: MealPreferences;  // persist ระดับทริป
```

---

## 2. Server function (`src/server/discover.functions.ts`)

ขยาย `MealsInput` และ `MealSuggestion`:

**Input ใหม่ (context-aware):**
- `destination`, `dayPlaces`, `lang` (เดิม)
- `mealTypes: MealType[]` (เลือกได้หลายมื้อ)
- `count: number` (จำนวนตัวเลือกที่ต้องการ — default 4)
- `preferences?: MealPreferences`
- `budget?: BudgetTier`, `travelers?: number`
- `lodgingLocation?: { lat, lng, name }` — ถ้ามื้อเย็น/เช้า ให้แนะนำใกล้โรงแรม
- `weather?: { condition: "rain" | "clear" | ..., tempC?: number }` — ฝน → แนะนำในร่ม
- `excludeNames?: string[]` — ชื่อร้านที่มีใน timeline แล้ว (ห้ามซ้ำ)
- `excludeCuisines?: string[]` — cuisine ที่กินไปแล้ว (กระจายความหลากหลาย)
- `nearLat?, nearLng?` — ใช้ตอนกด "Replace" เพื่อหาร้านใกล้จุดเดิม

**Output ขยาย:** `MealSuggestion` เพิ่ม `priceRange`, `rating`, `openHours`, `mealType`, `nearestPlaceName`, `distanceFromNearestKm`

System prompt อัปเดต: บอก AI ให้พิจารณา weather/lodging/preference อย่างชัดเจน, ไม่ซ้ำชื่อใน excludeNames, กระจาย cuisine

---

## 3. Store actions (`src/lib/store.ts`)

```ts
setMealPreferences(itineraryId, prefs: MealPreferences)
replacePlace(itineraryId, dayIndex, oldPlaceId, newPlace: Place)  // อะตอมิก สำหรับ Replace
```

---

## 4. Components ใหม่

### a) `src/components/MealCard.tsx`
การ์ดร้านอาหารใช้ซ้ำได้ (ใน dialog, inline suggest, replace popover)

Props: `meal: MealSuggestion`, `selected?`, `onToggleSelect?`, `onAdd?`, `compact?`

UI:
- รูป cover 16:9 (Unsplash query ตาม cuisine: `https://source.unsplash.com/400x250/?{cuisine},food`) มี fallback gradient
- ชื่อร้าน + cuisine badge + meal type badge (เช้า/เที่ยง/เย็น)
- ⭐ rating, 💰 priceRange ($, $$, $$$)
- 📍 ระยะห่าง "ใกล้ {nearestPlaceName} • {distanceFromNearestKm} km"
- ⏰ openHours ถ้ามี
- คำอธิบายสั้น 2 บรรทัด (line-clamp-2)
- footer: checkbox/Add button + ปุ่ม "ดูใน Maps" (Google Maps deep link)

### b) `src/components/MealSuggestDialog.tsx`
Dialog หลัก เปิดจากแต่ละวัน

State machine: `configure | loading | preview | error`

**Configure step:**
- Multi-select chips: meal types (เช้า/เที่ยง/เย็น/ของว่าง)
- Cuisine chips (ไทย/ญี่ปุ่น/สตรีท/คาเฟ่/ตะวันตก/...) — preset จาก `mealPreferences.cuisines`
- Diet chips (มังสวิรัติ/วีแกน/ฮาลาล) — preset จาก `mealPreferences.diet`
- Price tier (฿/฿฿/฿฿฿) — default จาก `itinerary.budget`
- Slider: จำนวนตัวเลือก 3-8 (default 4)
- Toggle: "ใกล้ที่พักของวันนี้" (เปิดถ้า `lodgings` มี dayIdx นี้)
- ปุ่ม "บันทึกเป็นค่าเริ่มต้น" → `setMealPreferences`
- ปุ่ม Submit

**Loading step:** skeleton 4 cards

**Preview step:**
- Grid `MealCard` พร้อม checkbox "เลือก"
- ทุกการ์ดมี select per-place dropdown: "วางหลัง: {place name}" เพื่อเลือกตำแหน่งใน timeline
- ปุ่ม "เลือกทั้งหมด" / "ล้าง"
- ปุ่ม "เพิ่ม {n} ร้าน" → `addPlace` ทีละตัวพร้อม index ที่เลือก
- ปุ่ม "ขออีกครั้ง" (ส่ง excludeNames ของรอบก่อน)

**Error step:** แสดง message + retry

ส่ง context ครบ: `lodgingLocation` (ดึงจาก `itinerary.lodgings` ที่ผูก dayIdx), `weather` (ใช้ store ที่มีอยู่ — ถ้าไม่มี ปล่อย undefined), `excludeNames`, `excludeCuisines` (ดึงจาก places kind=meal ที่มีอยู่ทุกวันก่อนหน้า)

### c) `src/components/MealSlotInline.tsx`
Dashed placeholder card ที่แทรกใน timeline

Logic: คำนวณช่วงเวลา gap จาก places ในวัน ถ้าไม่มี place ในช่วง 11:00–14:00 → render slot "🍽 มื้อกลางวัน" ที่ตำแหน่งนั้น เช่นเดียวกับ 17:30–20:30 (เย็น), 7:00–9:30 (เช้า — เปิดเมื่อมีค้างคืน)

UI: dashed border, ไอคอน + ข้อความ "ยังไม่มีมื้อ{เที่ยง} — แตะเพื่อให้ AI แนะนำ"

แตะ → เปิด `MealSuggestDialog` โดย preset `mealTypes=[<slot นั้น>]` และ `count=3`

### d) `src/components/MealEmptyBanner.tsx`
Banner ขนาดเล็กใต้ header ของ DaySection ถ้าวันนั้นไม่มี place ไหน `kind === "meal"`

UI: bg ส้มอ่อน, ไอคอน 🍴, ข้อความ "วันนี้ยังไม่มีร้านอาหารในแผน", ปุ่ม "ให้ AI แนะนำ" → เปิด dialog

---

## 5. Replace action (timeline)

ใน `itinerary.$id.tsx` ส่วน render place card: ถ้า `place.kind === "meal"` เพิ่มเมนู kebab/dropdown "เปลี่ยนร้าน"

แตะ → เปิด popover `MealReplacePopover` (component ย่อย):
- เรียก `suggestMeals` ด้วย `nearLat/nearLng = place.lat/lng`, `count=3`, `excludeNames=[place.name]`, `mealTypes` เดาจากเวลา (`place.time`)
- แสดง 3 `MealCard` แบบ compact
- คลิกตัวไหน → `replacePlace` (เก็บ id และ slot/time เดิม) แล้วปิด popover

---

## 6. UI integration ใน `src/routes/itinerary.$id.tsx`

- ลบ logic `handleSuggestMeals` + state `mealsLoading` + ปุ่ม "🍴 แนะนำมื้ออาหาร" เดิม
- เพิ่ม state `mealDialog: { open, presetMealTypes?, insertNearPlaceId? }` ต่อวัน
- ปุ่มใหม่ในแถบ action: "🍴 มื้ออาหาร" → เปิด dialog แบบ full configure
- Render `<MealEmptyBanner />` ใต้ day header เมื่อยังไม่มี meal
- Render `<MealSlotInline />` แทรกใน timeline ตามช่วงเวลาที่ว่าง
- Place card ที่ `kind="meal"` มี action "เปลี่ยน" → `MealReplacePopover`

---

## 7. i18n keys ใหม่ (`src/lib/i18n.ts`)

th + en สำหรับ:
- `mealDialogTitle`, `mealDialogSubtitle`
- `mealTypeBreakfast/Lunch/Dinner/Snack`
- `mealCuisinesLabel`, `mealDietLabel`, `mealCountLabel`, `mealNearLodging`
- `mealSavePref`, `mealPrefSaved`
- `mealApplyAdd`, `mealRequestAgain`, `mealSelectAll`, `mealClearSelection`
- `mealEmptyBanner`, `mealEmptyAction`
- `mealSlotEmpty`, `mealSlotBreakfast/Lunch/Dinner`
- `mealReplaceTitle`, `mealReplaceConfirm`
- `mealNearPlace`, `mealOpenHours`, `mealPriceRange`
- `mealNoResults`, `mealLoading`

ลบ `suggestMeals`, `mealsAdded`เก่าไม่ต้อง — เก็บไว้ใช้ใน toast หลัง add

---

## 8. รายละเอียดทางเทคนิค

### Image placeholder
- ใช้ `https://images.unsplash.com/photo-...` ไม่ stable — แทนด้วย `https://source.unsplash.com/featured/400x250/?{encodeURIComponent(cuisine || "food")},restaurant`
- มี `<img>` `onError` → fallback gradient div with cuisine emoji (🍜🍱🍕)

### Weather context
ใช้ store/lib ที่มีอยู่ (`weather.ts`, `weather-anchor-store.ts`) ดึง weather ของวัน — ถ้าไม่มีค่า ส่ง undefined

### Lodging context
ใน dialog ดึง `itinerary.lodgings.find(l => l.dayIndexes?.includes(dayIdx))` ตัวแรก ใช้เป็น `lodgingLocation`

### Excluded cuisines/names
รวบรวมจาก `itinerary.days.flatMap(d => d.places).filter(p => p.kind==="meal")` ของทั้งทริป (ไม่ใช่แค่วันเดียว) ส่งให้ AI

### Slot detection logic (MealSlotInline)
เรียงเวลา places ในวัน → check coverage ของแต่ละช่วงตาม window:
```
breakfast: 7:00-9:30
lunch:     11:00-14:00
dinner:    17:30-20:30
```
ถ้าไม่มี place ใดมีเวลาอยู่ในช่วงนั้น → render slot ที่ตำแหน่งระหว่าง place ก่อน/หลังที่ติดกับช่วงเวลานั้นที่สุด

---

## 9. ไฟล์ที่จะสร้าง/แก้

**สร้างใหม่:**
- `src/components/MealCard.tsx`
- `src/components/MealSuggestDialog.tsx`
- `src/components/MealSlotInline.tsx`
- `src/components/MealEmptyBanner.tsx`
- `src/components/MealReplacePopover.tsx`

**แก้ไข:**
- `src/lib/types.ts` — เพิ่ม fields/types
- `src/lib/store.ts` — เพิ่ม `setMealPreferences`, `replacePlace`
- `src/server/discover.functions.ts` — ขยาย `suggestMeals` input/output, system prompt
- `src/lib/i18n.ts` — keys ใหม่ (th + en)
- `src/routes/itinerary.$id.tsx` — ลบ handler เดิม, integrate components ใหม่

---

## 10. Out of scope

- รูปร้านจริง (ไม่มี API) — ใช้ Unsplash query เป็น placeholder
- ราคาจริง/เวลาเปิดจริง — AI ประมาณการ ไม่รับประกันความถูกต้อง (แสดง disclaimer ใต้ dialog)
- รีวิวจริง — rating เป็นค่าประมาณจาก AI
- การจอง/สั่งอาหาร
