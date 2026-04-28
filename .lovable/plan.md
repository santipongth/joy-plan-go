## สรุปสิ่งที่มีอยู่แล้ว

Trip Planner เป็นเว็บแอปวางแผนทริปด้วย AI — มี: AI สร้างแผนทั้งทริป/รายวัน, drag-drop จัดเรียง + undo history, แผนที่ Leaflet พร้อม legend/filter, travel mode + anchor ต่อวัน, budget estimate หลายสกุล + per-day chart, print/share, i18n (ไทย/อังกฤษ), ทุกอย่างเก็บใน localStorage (Zustand persist) — ยังไม่มี backend/auth

---

## ฟีเจอร์ใหม่ที่แนะนำ (จัดกลุ่ม)

### กลุ่ม A — เพิ่มคุณค่าให้ทริป (เริ่มได้ทันที, ไม่ต้องใช้ Cloud)

**A1. Packing Checklist อัตโนมัติ**
สร้างเช็กลิสต์ของที่ต้องเตรียม โดยอ้างอิงจาก destination, จำนวนวัน, ฤดูกาล (จาก startDate), travel style, accommodation, companions

- รายการ default แบ่งหมวด: เอกสาร / เสื้อผ้า / สุขภาพ / อิเล็กทรอนิกส์ / กิจกรรมเฉพาะ
- ติ๊กเพื่อ mark เสร็จ, เพิ่มรายการเอง, persist ต่อทริป
- ปุ่ม "AI suggest extras" เรียก server function ขอแนะนำเพิ่มตามบริบท

**A2. Notes / Bookmarks ต่อสถานที่**
ปัจจุบัน Place เก็บแค่ description จาก AI — เพิ่ม:

- โน้ตส่วนตัวต่อ place (เวลาจริงที่จอง, เบอร์ติดต่อ, ลิงก์)
- ⭐ บุ๊กมาร์กเป็น must-visit
- 🚫 mark visited/skipped
- ไอคอนสถานะแสดงบน map marker และในรายการ

**A3. Day Cost Override + Actual Spending Tracker**
ต่อยอดจาก budget estimate:

- ผู้ใช้กรอกค่าใช้จ่ายจริงต่อวัน (Stay/Food/Transport/Other) ทับค่าประมาณ
- เปรียบเทียบ budget ประมาณ vs จริง พร้อม % เกิน/เหลือ
- บันทึกใบเสร็จแบบ text (จำนวน + คำอธิบาย)

**A4. Trip Templates / Duplicate Trip**

- "Save as template" จากทริปเก่าเพื่อสร้างใหม่โดย reset วันที่/places แต่คงค่า preferences
- "Duplicate trip" คัดลอกทั้งทริปสำหรับลองเวอร์ชันอื่น
- Built-in templates: "Weekend in Bangkok", "Tokyo 5 days" ฯลฯ (JSON ฝังไว้)

**A5. Time-of-day Slotting**
ปัจจุบัน places มีฟิลด์ `time` แต่เป็น string อิสระ — ทำให้ structured:

- แบ่งเป็นช่วง morning / afternoon / evening / night
- แสดง timeline แนวตั้งคล้าย Google Calendar
- เตือนเมื่อเวลารวม + leg minutes เกิน 24 ชม.หรือ overlap

**A6. Weather Forecast ต่อวัน**
ใช้ Open-Meteo API (ฟรี, ไม่ต้อง key) ตาม destination lat/lng + startDate

- แสดง icon + อุณหภูมิที่ header แต่ละวัน
- เตือนถ้าวันที่มี outdoor activity เจอฝนหนัก
  &nbsp;

---

### กลุ่ม B — Discovery & Recommendation (ใช้ AI server functions ที่มีอยู่ หรือใช้ Lovable AI)

**B1. "More like this" — แนะนำสถานที่เพิ่มต่อวัน**
ปุ่มที่ place card → AI เสนอ 3 สถานที่คล้าย ๆ ในละแวกเดียวกัน (ใช้ pattern เดียวกับ planSingleDay แต่จำกัดรัศมี)

**B2. Restaurant / Food แยกหมวด**
ปัจจุบัน places ปนกัน — เพิ่ม `kind: "attraction" | "meal" | "transit" | "stay"`

- AI สอดแทรกร้านอาหาร 2-3 มื้อต่อวันโดยอัตโนมัติเมื่อ kind ไม่ครอบคลุม
- แสดง icon ต่างกันบน map (ส้อม/ดาว/บ้าน)

**B3. Local Tips / Cultural Notes (ใช้** Lovable AI**)**  
หลัง generate แล้วเพิ่มกล่อง "What to know" — AI สรุปเรื่อง dress code, tipping, ภาษา, เวลาเปิด-ปิดทั่วไป, เทศกาลในช่วงนั้น

---

---

### กลุ่ม D — UX polish เล็ก ๆ

- D1. **Onboarding tour** (ใช้ shepherd.js หรือ custom popover) — ครั้งแรกที่เข้าหน้าทริป
- D2. **Keyboard shortcuts** — `⌘K` command palette (สลับวัน, regenerate, undo, ค้น place)
- D3. **Dark mode toggle** + persist (`map-style-store` มี style เก็บแล้ว ต่อยอดได้ง่าย)
- D4. **Currency auto-detect** จาก browser locale ครั้งแรก
- D5. **Map clustering** เมื่อ marker เยอะ (leaflet.markercluster) — ช่วยทริป >7 วัน

---



---

## ขั้นตอนต่อไป

ให้เริ่มทำทั้งหมด: A1 ถึง A6, B1 ถึง B3, D1 ถึง D5  
หลังจากนั้นเปิด Lovable Cloud แล้วทำ **C1 Auth + Sync** เป็นก้าวกระโดดไปสู่ multi-device ให้เปิด Lovable Cloud และ Lovable AI ด้วย   


แล้วผมจะวาง plan รายฟีเจอร์ที่ละเอียดสำหรับ implementation