# Travel Planner (คล้าย Trip.com TripPlanner)

เว็บแอปวางแผนการเดินทางแบบ MVP เต็มฟีเจอร์ — กรอกจุดหมาย, ให้ AI สร้างแผนเดินทางรายวัน, ดูสถานที่บนแผนที่, และบันทึกแผนของคุณไว้ใช้ภายหลัง รองรับภาษาไทย/อังกฤษ

## Layout หลัก (หน้าเดียว split-view)

```text
┌──────────────────────────────┬──────────────────────────────┐
│  Logo  Trip.Planner    [TH/EN]│                              │
│                              │                              │
│  ┌── Planner Card ─────────┐ │                              │
│  │ Starting from: [____]   │ │                              │
│  │ Heading to:    [____]   │ │        แผนที่ Leaflet         │
│  │ Date / Duration: [___]  │ │      (OpenStreetMap)         │
│  │ ♡ Preferences ▾          │ │                              │
│  │ [Create Myself][✨ AI]  │ │     หมุดสถานที่ + เส้นทาง    │
│  └─────────────────────────┘ │                              │
│                              │                              │
│  My Itineraries              │                              │
│  ┌──────┐ ┌──────┐ ┌──────┐  │                              │
│  │ card │ │ card │ │ card │  │                              │
│  └──────┘ └──────┘ └──────┘  │                              │
└──────────────────────────────┴──────────────────────────────┘
```

มือถือ: แผนที่ย้ายไปอยู่ใต้ฟอร์ม / มี tab สลับ List ↔ Map

## ฟีเจอร์

**1. ฟอร์มวางแผน**
- ช่อง "Starting from" และ "Heading to" — autocomplete จาก OpenStreetMap Nominatim (ฟรี ไม่ต้องมี key)
- เลือกช่วงวัน + จำนวนวัน (1–14 วัน)
- Preferences (collapsible): ประเภททริป (วัฒนธรรม / ธรรมชาติ / อาหาร / ช้อปปิ้ง / ครอบครัว), งบประมาณ, ความเร็ว (สบายๆ/ปกติ/อัดแน่น)
- 2 ปุ่ม: "Create It Myself" (สร้างทริปเปล่า) / "Plan a Trip with AI" (เรียก AI)

**2. AI สร้าง itinerary**
- ใช้ Lovable AI (google/gemini-3-flash-preview) ผ่าน server function
- ส่ง origin/destination/วัน/preferences → AI คืนเป็น structured JSON: รายวัน, แต่ละวันมีสถานที่ (ชื่อ, คำอธิบายสั้น, ช่วงเวลา, ประเภท, lat/lng)
- มี loading state + จัดการ 429/402 error พร้อม toast

**3. หน้า Itinerary Detail**
- เปิดเมื่อคลิกการ์ด หรือเมื่อ AI สร้างเสร็จ
- ฝั่งซ้าย: timeline รายวัน — แต่ละสถานที่มีรูป icon, ชื่อ, เวลา, คำอธิบาย, ปุ่มลบ/แก้
- ฝั่งขวา: แผนที่ปักหมุดทุกจุด + เส้นเชื่อมตามลำดับของแต่ละวัน, สีหมุดแยกตามวัน
- คลิกหมุด → highlight การ์ดในรายการ และในทางกลับกัน
- Drag-and-drop เรียงลำดับสถานที่ใหม่ (ภายในวันเดียวกัน)
- ปุ่ม: เพิ่มสถานที่เอง, เปลี่ยนชื่อทริป, ลบทริป, Export เป็น JSON

**4. บันทึก & รายการของฉัน**
- ทุก itinerary บันทึกใน `localStorage` อัตโนมัติ (auto-save)
- การ์ด "My Itineraries" บนหน้าแรก: รูป cover (รูปแรกของทริป), ชื่อ, จำนวนวัน·สถานที่·เมือง, วันที่อัปเดตล่าสุด
- คลิกการ์ดเพื่อเปิด/แก้, hover ดูปุ่มลบ

**5. แผนที่ (Leaflet + OSM)**
- โหลดทั้ง globe ตอนเริ่มต้น zoom out เห็นทวีปต่างๆ พร้อม cluster หมุดของทริปที่บันทึกไว้
- ตอนเลือกทริป: zoom ไปที่ bbox ของสถานที่ทั้งหมดในทริป
- หมุด custom icon รูปกลม + เลขลำดับ
- เส้นทางเชื่อมจุดด้วย polyline (เส้นตรงระหว่างจุด — ไม่ใช้ routing API)

**6. สลับภาษา ไทย/อังกฤษ**
- Toggle TH/EN ที่มุมขวาบน, จดจำใน localStorage
- ครอบคลุมทุก label, ปุ่ม, ข้อความ system
- AI prompt ปรับตามภาษาที่เลือก (สร้างคำอธิบายสถานที่เป็นภาษานั้น)

## รายละเอียดทางเทคนิค

- **เส้นทาง**: หน้าเดียว `/` (split-view planner + map) และ `/itinerary/$id` สำหรับหน้า detail
- **State**: Zustand store สำหรับ itineraries + ภาษาปัจจุบัน, sync กับ localStorage
- **แผนที่**: `react-leaflet` + `leaflet` (OpenStreetMap tiles, ไม่ต้อง API key)
- **Autocomplete สถานที่**: เรียก Nominatim API ตรงจากฝั่ง client (ฟรี, มี rate limit แต่พอสำหรับ MVP)
- **AI**: Server function `/api/ai/plan-trip` เรียก Lovable AI Gateway ด้วย tool calling เพื่อรับ structured JSON (สถานที่ + พิกัด)
- **i18n**: Object dictionary ง่ายๆ (`{ th: {...}, en: {...} }`) + hook `useT()` — ไม่ใช้ library หนัก
- **UI**: shadcn components ที่มีอยู่แล้ว (Card, Button, Input, Popover, Calendar, Collapsible, Sonner toast)
- **Drag-and-drop**: `@dnd-kit/sortable`
- **เปิดใช้ Lovable Cloud** เพื่อให้ใช้ AI Gateway (LOVABLE_API_KEY)

## ดีไซน์

- โทนสว่าง พื้นหลังฟ้าอ่อน gradient คล้ายภาพอ้างอิง
- Primary: indigo-violet gradient สำหรับปุ่ม AI
- การ์ด rounded-2xl, soft shadow, รูป cover 16:9
- Typography: Inter, headers semibold
