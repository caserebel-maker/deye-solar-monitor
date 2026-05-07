# Deye Solar Monitor

เว็บแอป Next.js + TypeScript สำหรับ monitor ระบบ Solar Inverter Deye + Battery บนจอคอม/แท็บเล็ต โดยอ่านข้อมูลผ่าน server-side API routes เท่านั้น และ fallback เป็น mock data เมื่อยังไม่ได้ตั้งค่า Deye Cloud API

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- lucide-react

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

เปิด `http://localhost:3000`

ถ้ายังไม่ใส่ค่า API ใน `.env.local` dashboard จะขึ้น `Mock data` และยังใช้งานได้ครบทั้ง cards, flow diagram, charts และ alarm log

## Environment Variables

```bash
DEYE_API_BASE_URL=https://eu1-developer.deyecloud.com/v1.0
DEYE_API_KEY=
DEYE_USERNAME=
DEYE_PASSWORD=
DEYE_STATION_ID=
DEYE_DEVICE_ID=
```

อย่าใส่ credential ใน frontend หรือ commit ไฟล์ `.env.local`

## API Architecture

Frontend เรียกเฉพาะ route ภายในแอป:

- `GET /api/solar/overview`
- `GET /api/solar/history`
- `GET /api/solar/alarms`

ไฟล์ [lib/deye-api.ts](/Users/ebcimord/Documents/Codex/2026-05-07/monitor-solar-inverter-deye-battery-web/lib/deye-api.ts) เป็น service layer กลางสำหรับ:

- อ่าน env บนฝั่ง server
- ตรวจว่ามี config เพียงพอสำหรับ live API หรือไม่
- normalize response ให้ frontend ใช้ shape เดียว
- fallback เป็น mock data เมื่อยังไม่มี key หรือ request live API ล้มเหลว

หมายเหตุ: endpoint live ใน service layer ถูกวางเป็น adapter placeholder (`/station/{id}/overview`, `/history`, `/alarms`) เพื่อให้ต่อ mapping จริงหลังได้เอกสาร/สิทธิ์ DeyeCloud API แล้ว โดยไม่ต้องแก้ frontend

## Deye Cloud API Access

จากข้อมูลที่ตรวจสอบ:

- เว็บไซต์ Deye Cloud ของ Deye ระบุความสามารถ `OpenAPI` ใน product architecture: <https://www.deyeinverter.com/deye-cloud/>
- มี developer portal ที่ระบุใน repo ตัวอย่างอย่างเป็นทางการ: <https://developer.deyecloud.com>
- repo ตัวอย่าง `DeyeCloudDevelopers/deye-openapi-client-sample-code` ระบุว่าต้องสร้าง DeyeCloud account, สร้าง DeyeCloud application ใน developer portal, แล้วนำ `AppId` และ `AppSecret` ไปขอ token: <https://github.com/DeyeCloudDevelopers/deye-openapi-client-sample-code>
- มี Postman collection ชื่อ DeyeCloud APIs ที่มี request เช่น obtain token, organization info, station history data: <https://www.postman.com/deye22/deye-cloud-open-api/collection/u6idziz/deyecloud-apis>

ขั้นตอนโดยสรุป:

1. สมัคร/เข้าสู่ระบบ DeyeCloud ที่ <https://www.deyecloud.com>
2. เข้า developer portal ที่ <https://developer.deyecloud.com>
3. สร้าง application เพื่อรับ `AppId` / `AppSecret` หรือ API credential ที่ portal ออกให้
4. ขอ/เปิดสิทธิ์ API สำหรับ account หรือ organization ที่มี station/device ของคุณ
5. หา `station id` และ `device id` จาก DeyeCloud web/app, developer portal, หรือ endpoint organization/station/device list หลัง login
6. ใส่ค่าลง `.env.local` แล้ว restart dev server

ถ้ามีปัญหาเรื่องสิทธิ์หรือ endpoint ตาม repo ตัวอย่าง Deye แนะนำติดต่อ `cloudservice@deye.com.cn`

## Security Notes

- API key/password ถูกอ่านเฉพาะใน route handlers ฝั่ง server
- ไม่มี `NEXT_PUBLIC_*` สำหรับ credential
- `.env` และ `.env*.local` ถูก ignore
- route handlers มี error handling และ frontend มี loading/error/offline state

## Verification

```bash
npm run typecheck
npm run build
```
