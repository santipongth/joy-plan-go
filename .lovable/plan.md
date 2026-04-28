
# แผน: แนะนำที่พัก & การคมนาคมขนส่ง

## เป้าหมาย
เพิ่มสองฟีเจอร์ AI ใหม่ให้กับหน้า itinerary:
1. **แนะนำที่พัก/โรงแรม** — แนะนำโรงแรม/โฮสเทล/รีสอร์ตที่ใกล้เคียงกับสถานที่ในแต่ละวันหรือทั้งทริป
2. **แนะนำการคมนาคมขนส่ง** — แนะนำวิธีเดินทาง (รถไฟ, BTS/MRT, แท็กซี่, เดิน, เช่ารถ) ระหว่างจุดต่อจุดในแต่ละวัน พร้อมเวลา/ค่าใช้จ่ายโดยประมาณ

## 1. ขยาย Data Model (`src/lib/types.ts`)

เพิ่ม type ใหม่และขยาย `Itinerary`/`DayPlan`:

```ts
export interface Lodging {
  id: string;
  name: string;
  type: "hotel" | "hostel" | "resort" | "guesthouse" | "apartment";
  lat: number;
  lng: number;
  priceTier?: BudgetTier;          // low/medium/high
  pricePerNight?: number;          // ประมาณการ
  currency?: string;
  rating?: number;                 // 0-5
  description?: string;
  bookingUrl?: string;             // deep link ไป Booking/Agoda search
  amenities?: string[];            // wifi, pool, breakfast...
  dayIndexes?: number[];           // วันที่ใช้พักโรงแรมนี้
}

export type TransportMode =
  | "walk" | "transit" | "taxi" | "rideshare"
  | "train" | "bus" | "subway" | "ferry" | "bike" | "car";

export interface TransportLeg {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: TransportMode;
  durationMin?: number;
  distanceKm?: number;
  costEstimate?: number;
  currency?: string;
  instructions?: string;          // เช่น "BTS อโศก → สยาม (3 สถานี)"
  alternatives?: Array<{ mode: TransportMode; durationMin?: number; costEstimate?: number; note?: string }>;
}

// ขยาย DayPlan
export interface DayPlan {
  // ...เดิม
  transport?: TransportLeg[];     // ตามลำดับ leg ระหว่าง places
}

// ขยาย Itinerary
export interface Itinerary {
  // ...เดิม
  lodgings?: Lodging[];           // เก็บโรงแรมที่ผู้ใช้บันทึก
}
```

## 2. Server Functions (`src/server/`)

ไฟล์ใหม่ `suggest-lodging.functions.ts` และ `suggest-transport.functions.ts` ใช้รูปแบบเดียวกับ `plan-trip.functions.ts` (Lovable AI Gateway + tool calling, model `google/gemini-3-flash-preview`).

**`suggestLodging`** — input: `destination`, `centerLat/Lng` (เช่น centroid ของ places วันนั้น หรือ destination), `budget`, `travelers`, `nights`, `preferences` (style, amenities), `lang`. Output: array ของ `Lodging` (4–6 ตัวเลือก) ที่มี lat/lng จริง พร้อม `bookingUrl` ที่ build เป็น Booking.com search URL จาก name+lat/lng (ไม่มี API จริง — ใช้ deep link search เพื่อให้ผู้ใช้กดต่อเอง)

**`suggestTransport`** — input: `dayPlaces` (เรียงตามลำดับ), `travelMode` ที่ผู้ใช้ตั้ง, `destination`, `lang`. Output: array `TransportLeg` หนึ่ง leg ต่อช่วง place→place โดยให้ AI เลือกโหมดที่เหมาะที่สุดในเมืองนั้น (เช่น กรุงเทพ → BTS/MRT, เกียวโต → รถไฟ/เดิน) พร้อมเวลา ค่าใช้จ่ายประมาณ และคำอธิบายสั้น + ทางเลือก 1–2 ตัว

ทั้งสองฟังก์ชันจัดการ `RATE_LIMIT` / `PAYMENT_REQUIRED` แบบเดียวกับฟังก์ชันที่มีอยู่

## 3. Store actions (`src/lib/store.ts`)

```ts
addLodging(itineraryId, lodging)
removeLodging(itineraryId, lodgingId)
assignLodgingToDays(itineraryId, lodgingId, dayIndexes)
setDayTransport(itineraryId, dayIndex, legs: TransportLeg[])
clearDayTransport(itineraryId, dayIndex)
```

## 4. UI Components

### a) `src/components/LodgingSuggestDialog.tsx`
ปุ่มเปิด dialog ที่ header ของ itinerary (อยู่ใกล้ปุ่ม AI Suggest เดิม) ไอคอน `BedDouble`
- Configure: เลือก budget tier, จำนวนคน, จำนวนคืน, วันที่ใช้โรงแรมนี้ (multi-select day chips), preferences (สระว่ายน้ำ/อาหารเช้า/ใกล้รถไฟฟ้า)
- Running: เรียก `suggestLodging`
- Preview: card list แสดงแต่ละโรงแรม → ชื่อ, type badge, rating, ราคา/คืน, amenity chips, ปุ่ม "Book on Booking.com" (เปิด tab ใหม่), checkbox "Add to trip"
- Apply → `addLodging` + `assignLodgingToDays`

### b) `src/components/LodgingList.tsx`
แสดงในหน้า itinerary (ใต้ trip header หรือใน sidebar) — list โรงแรมที่ save ไว้พร้อม day chips, ปุ่มลบ, ปุ่มเปิด booking link, แสดงหมุดบนแผนที่หลัก (ใช้สี/ไอคอนพิเศษ — แก้ `MapView.tsx` ให้รับ `lodgings` prop)

### c) `src/components/DayTransportPanel.tsx`
แสดงภายใน day card ใน `itinerary.$id.tsx` ระหว่างรายการ places
- ปุ่ม "Suggest transport" — เรียก `suggestTransport` สำหรับวันนั้น
- หลังได้ผล แสดง timeline: place A — [icon mode + duration + cost] — place B
- คลิก leg เพื่อ expand ดู instructions + alternatives
- ปุ่มเปลี่ยนโหมดด้วยตัวเอง (dropdown) → update store
- รีเฟรช/ล้างได้

### d) Map enhancements (`MapView.tsx` + `DayMiniMap.tsx`)
- รับ prop `lodgings` แสดง marker ไอคอนเตียง
- (Optional ถ้าง่าย) วาดเส้นระหว่าง legs ด้วยสีตาม mode

## 5. i18n (`src/lib/i18n.ts`)
keys ใหม่ทั้ง th/en: `lodgingSuggest`, `lodgingTitle`, `lodgingBookOn`, `lodgingPriceNight`, `lodgingNights`, `lodgingApplyToDays`, `transportSuggest`, `transportLeg`, `transportAlternatives`, `transportMode_*`, `transportDuration`, `transportCost`, `noTransportYet`, ฯลฯ

## 6. Booking deep link (no API key)
ในฝั่ง client/server ประกอบ URL:
```
https://www.booking.com/searchresults.html?ss={encodeURIComponent(name)}&latitude={lat}&longitude={lng}
```
เก็บไว้ใน `lodging.bookingUrl` ตอน save

## 7. ไฟล์ที่จะแก้/สร้าง
- สร้าง: `src/server/suggest-lodging.functions.ts`, `src/server/suggest-transport.functions.ts`, `src/components/LodgingSuggestDialog.tsx`, `src/components/LodgingList.tsx`, `src/components/DayTransportPanel.tsx`
- แก้: `src/lib/types.ts`, `src/lib/store.ts`, `src/lib/i18n.ts`, `src/routes/itinerary.$id.tsx` (ติดตั้งปุ่ม + panel), `src/components/MapView.tsx`, `src/components/DayMiniMap.tsx`

## 8. Out of scope (รอบนี้)
- ดึงราคา/ห้องว่างจริงจาก Booking/Agoda (ต้องการ API + business account)
- เส้นทาง routing จริงจาก Google Directions / Mapbox (ต้องการ API key — ปัจจุบันใช้ Nominatim/Leaflet ฟรีเท่านั้น)
- การจองตรงในแอป
หากต้องการของจริงในอนาคต ค่อยเพิ่ม connector หรือ API key

---

**ขอยืนยัน 2 จุดก่อนลงมือ:**
1. ใช้ deep link ไปยัง Booking.com (ไม่ดึงราคาจริง) สำหรับเริ่มต้น — โอเคไหม หรืออยากเชื่อมต่อ API จริง (ต้องเพิ่ม API key)
2. แสดง "Lodging" เป็น **section ใหม่ที่ระดับทริป** (หนึ่ง list สำหรับทั้งทริป + ผูกกับวัน) ตามที่เสนอ หรืออยากให้แต่ละวันมีโรงแรมของตัวเองแยกกัน
