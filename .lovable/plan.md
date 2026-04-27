## สิ่งที่จะทำ

### 1. Summary Card ด้านขวา (เรียลไทม์ก่อนกดยืนยัน)
เพิ่ม **PreferencesSummary** เป็นการ์ดลอยซ้อนทับด้านบนของแผนที่ (ฝั่งขวา) บน `src/routes/index.tsx` แสดงผลทันทีเมื่อผู้ใช้แก้ไขค่าใด ๆ ใน Preferences

แสดงข้อมูลแบ่งเป็นหมวด:
- Destination + Origin + Start date + Duration
- Interests (badges)
- Budget / Pace / Travel pace
- Companions / Travel style / Accommodation / Day's rhythm
- Other needs (truncate ที่ ~120 ตัวอักษร)

ดีไซน์:
- การ์ดเล็กในมุมขวาบนของ MapView area, พื้นหลัง `bg-background/95 backdrop-blur`, แสดงเฉพาะหมวดที่มีค่า
- มี header "สรุปความชอบของคุณ / Your preferences"
- มีตัวนับ "X / Y categories selected"
- ถ้ายังไม่ได้เลือกอะไรเลย แสดงข้อความ hint

### 2. Validation + คำเตือนก่อนส่งแพลน
ใน `onAIPlan` (และ `onCreateMyself`) เพิ่มลำดับการตรวจสอบ ก่อนเรียก server:

- **Required**: destination ต้องไม่ว่าง → toast.error
- **Soft warnings** (toast.warning, ยังคงส่งได้): 
  - ไม่เลือก interests เลย และไม่กรอก otherNeeds → "เลือกอย่างน้อย 1 ประเภททริปเพื่อผลลัพธ์ดีขึ้น"
  - days > 10 และ pace = "packed"/"ambitious" → "ทริปยาวร่วมกับจังหวะอัดแน่นอาจเหนื่อย"
- **Hard errors** (block submit):
  - otherNeeds เกิน 1000 ตัวอักษร → toast.error
  - destination > 200 ตัวอักษร
  - days < 1 หรือ > 14
  - rhythm มี earlyStarts และ lateNights พร้อมกัน → เตือนว่าขัดแย้งกัน (ให้ผู้ใช้ยืนยัน)

เพิ่มแถบ inline warning เล็ก ๆ ภายใน Preferences panel แสดงรายการ issues สด ๆ ขณะแก้ไข (สีเหลือง/แดงตามระดับ)

เพิ่ม i18n keys ใหม่: `summaryTitle`, `summaryEmpty`, `categoriesSelected`, `warnNoInterests`, `warnPaceLong`, `warnRhythmConflict`, `warnOtherNeedsTooLong`, `warnDestinationTooLong`

### 3. ปรับ prompt ฝั่ง server ให้เป็นระเบียบ + dedupe
แก้ `src/server/plan-trip.functions.ts`:

- เพิ่ม helper `buildPreferencesBlock(data)` ที่:
  - แปลงทุกฟิลด์เป็น **bullet list หมวดหมู่** แทน inline text:
    ```
    User Preferences:
    - Travel companions: Family
    - Travel style: Cultural, Historical
    - Budget: Mid-range
    - Pace: Moderate
    - Accommodation: Premium
    - Day rhythm: Early starts
    - Interests: Culture, Food
    - Other needs: <text>
    ```
  - **Deduplicate** ค่าซ้ำในแต่ละ array (case-insensitive) — เช่น "Cultural" ใน travelStyle ซ้อน "Culture" ใน interests
  - **ตรวจ conflict ภายใน**: ถ้า rhythm มีทั้ง earlyStarts + lateNights → รวมเป็น "Flexible (mixed early/late)"
  - กรองค่าว่าง / undefined / whitespace-only ออก
  - ตัด otherNeeds เหลือไม่เกิน 1000 ตัวอักษร (server-side guard)
- เพิ่มประโยคใน system prompt: `"Strictly respect the user preferences listed below. If two preferences conflict, prioritise the more specific one and note the trade-off briefly in the day's title or place description."`
- ใช้ helper เดียวกันทั้งใน `planTrip` และ `planSingleDay` (ส่ง preferences เพิ่มผ่าน input ของ `planSingleDay` เพื่อให้ regenerate รายวันสอดคล้องกัน — เพิ่ม optional fields เดียวกันใน `PlanDayInput`)

อัปเดต call site ของ `planSingleDay` ใน `src/routes/itinerary.$id.tsx` ให้ส่งค่า preferences ที่บันทึกไว้กับ itinerary (ถ้ามี — ขั้นนี้จะไม่ persist preferences ลง store ในรอบนี้ จะส่งเฉพาะ interests/budget/pace ที่มีอยู่แล้ว)

## ไฟล์ที่จะแก้
- `src/routes/index.tsx` — Summary card, validation logic, inline warnings
- `src/server/plan-trip.functions.ts` — `buildPreferencesBlock` helper, dedupe, conflict resolve, ใช้ทั้ง 2 server fn
- `src/lib/i18n.ts` — i18n keys ใหม่ (TH/EN)
