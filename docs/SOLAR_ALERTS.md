# Solar Production Alerts (Telegram)

ส่ง **status update ทุก 30 นาที** ช่วงกลางวัน (BKK 07:30–16:30) — แต่ละข้อความบอกว่ากำลังผลิตอยู่เท่าไหร่ + เกินหรือต่ำกว่า threshold (default 2.5 kW)

## ภาพรวม

```
Vercel Cron (every 30 min, all UTC hours)
   │
   ▼
GET /api/cron/solar-threshold
   │ (verify CRON_SECRET)
   ▼
Daylight check: Bangkok time ∈ [07:30, 16:30]?
   │   ├─ no → skip (return ok+skipped)
   │   └─ yes
   ▼
getSolarOverview() จาก Deye API
   │
   └─ source = "live" → sendTelegramMessage() พร้อม indicator ▲ (over) / ▼ (under)
```

**ส่งเสมอช่วงกลางวัน** ไม่ว่าเกินหรือต่ำกว่า — ข้อความบอกสถานะเอง
~19 messages/วัน ในช่วง 07:30–16:30 (นอกช่วงนี้ skip)

---

## Setup (3 ขั้นตอน, ~5 นาที)

### Step 1 — สร้าง Telegram bot

1. เปิด Telegram → ค้นหา [`@BotFather`](https://t.me/botfather)
2. ส่ง `/newbot`
3. ตั้งชื่อ bot: `EBCI Solar Monitor` (อะไรก็ได้)
4. ตั้ง username: `ebci_solar_bot` (ต้องลงท้ายด้วย `_bot`, unique)
5. BotFather จะส่ง **Bot Token** กลับมา — หน้าตาแบบ:
   ```
   8123456789:AAH_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   **เก็บไว้** — เป็น secret

### Step 2 — หา chat_id ของคุณ

1. เปิด chat กับ bot ที่เพิ่งสร้าง (Telegram → search ชื่อ bot)
2. กด **Start** หรือพิมพ์ `/start`
3. เปิด browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   (แทน `<YOUR_BOT_TOKEN>` ด้วย token จาก step 1)
4. หาในผลลัพธ์ JSON:
   ```json
   "chat": { "id": 123456789, ... }
   ```
   ตัวเลข `id` นั้นคือ **chat_id**

### Step 3 — ใส่ env vars ใน Vercel

```bash
cd <path-to-deye-solar-monitor>

# Bot token (encrypted)
echo "<BOT_TOKEN>" | npx vercel env add TELEGRAM_BOT_TOKEN production preview development

# Chat ID (plain ตัวเลข)
echo "<CHAT_ID>" | npx vercel env add TELEGRAM_CHAT_ID production preview development

# Cron secret (random string — ป้องกัน endpoint โดน hit จากภายนอก)
openssl rand -hex 32 | npx vercel env add CRON_SECRET production preview development

# (Optional) override threshold ถ้าไม่ใช้ default 2.5
# echo "3.0" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production preview development
```

หรือใช้ UI: vercel.com → project → Settings → Environment Variables

---

## Deploy

```bash
git add vercel.json app/api/cron/ lib/telegram.ts .env.example docs/SOLAR_ALERTS.md
git commit -m "feat(alerts): hourly Telegram alert when solar > 2.5 kW"
git push origin main
# Vercel auto-deploy + register cron
```

---

## Test ก่อน cron จะ fire ครั้งแรก

### Manual test ผ่าน curl

```bash
# ใช้ CRON_SECRET ที่ตั้งไว้ใน step 3
SECRET=$(npx vercel env pull .env.local --yes && grep CRON_SECRET .env.local | cut -d= -f2 | tr -d '"')

curl -H "Authorization: Bearer $SECRET" \
  https://monitor-solar-inverter-deye-battery.vercel.app/api/cron/solar-threshold
```

**Response:**
```json
{ "ok": true, "sent": true, "power": 2.81, "threshold": 2.5 }
```

→ Telegram จะส่งข้อความเข้าทันที ✅

### ถ้า solar ยังต่ำกว่า threshold

Response:
```json
{ "ok": true, "sent": false, "power": 0.32, "threshold": 2.5, "reason": "below threshold" }
```

ลด threshold ลงชั่วคราวเพื่อทดสอบ:
```bash
echo "0.1" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production
npx vercel deploy --prod --yes
```

ทดสอบเสร็จอย่าลืมเปลี่ยนกลับ 2.5

---

## ตัวอย่าง message

**ตอนผลิตเกิน threshold:**
```
☀️ Solar > 2.5 kW

⚡ ตอนนี้ผลิต 2.81 kW ▲
🏠 บ้านใช้ 0.94 kW
💡 Surplus 1.87 kW — เปิดเครื่องใช้ไฟได้
📊 วันนี้สะสม 14.2 kWh
🔋 Battery 87%

[เปิด dashboard]
```

**ตอนผลิตต่ำกว่า threshold:**
```
🌤️ Solar < 2.5 kW

⚡ ตอนนี้ผลิต 1.42 kW ▼
🏠 บ้านใช้ 1.85 kW
📥 Import 0.43 kW — ดึงไฟจาก grid/battery
📊 วันนี้สะสม 14.2 kWh
🔋 Battery 87%

[เปิด dashboard]
```

---

## ปรับ behavior

### เปลี่ยน threshold
```bash
echo "3.0" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production --force
```

### เปลี่ยนช่วงเวลากลางวัน
default: BKK 07:30–16:30 (cron ที่ออกนอกช่วงนี้จะ skip)
รองรับ format `HH:MM` หรือ `H` (เลขชั่วโมงเต็ม):
```bash
echo "08:00" | npx vercel env add SOLAR_ALERT_TIME_START production --force
echo "17:30" | npx vercel env add SOLAR_ALERT_TIME_END   production --force
# หรือเลขชั่วโมงเต็ม:
echo "9"     | npx vercel env add SOLAR_ALERT_TIME_START production --force
echo "17"    | npx vercel env add SOLAR_ALERT_TIME_END   production --force
```

### ลด/เพิ่มความถี่
แก้ `vercel.json`:
```json
{ "schedule": "*/30 * * * *" }   // ทุก 30 นาที (default)
{ "schedule": "0 * * * *" }      // ทุกชั่วโมง
{ "schedule": "*/15 * * * *" }   // ทุก 15 นาที (= ~52 ข้อความ/วัน กลางวัน)
{ "schedule": "0 */2 * * *" }    // ทุก 2 ชม.
```

แล้ว `git commit + push` deploy ใหม่

### Force send นอกช่วงกลางวัน (debug)
```bash
curl -H "Authorization: Bearer $SECRET" \
  "https://monitor-solar-inverter-deye-battery.vercel.app/api/cron/solar-threshold?force=1"
```
`?force=1` ข้าม daylight check ส่งให้เลย (มีประโยชน์ตอน test)

### ส่งหลายคน
สร้าง Telegram **group**, เพิ่ม bot เข้า group, หา group chat_id (จะเริ่มด้วย `-100...`) แล้วใส่ใน `TELEGRAM_CHAT_ID` แทน

---

## Troubleshooting

| อาการ | แก้ |
|---|---|
| Vercel cron ไม่ fire | Vercel free plan = cron จำกัด — เช็ค Settings → Crons → ดู status |
| `Telegram API 401: Unauthorized` | bot token ผิด — รีเช็ค |
| `Telegram API 400: chat not found` | chat_id ผิด — start bot ใหม่ + getUpdates |
| 401 จาก curl test | Bearer token ไม่ตรง — pull env ใหม่ `npx vercel env pull` |
| ข้อความไม่มี markdown formatting | parse_mode "Markdown" — escape `_*[]` ใน text ถ้ามี |
| ส่งทุก 30 นาที รำคาญ | แก้ vercel.json เป็น `0 * * * *` (ทุกชั่วโมง) หรือ `0 */2 * * *` (ทุก 2 ชม.) |
| ไม่อยากเห็นข้อความตอน solar = 0 ตอนค่ำ | เปลี่ยน `SOLAR_ALERT_TIME_END` ให้แคบลง เช่น `15:30` |
| อยาก mute ตอนกลางคืน | Telegram client → silence chat กับ bot ตอนนอน |

---

## Future enhancements

- [ ] เพิ่ม alert "battery < 20%" ส่งเตือน
- [ ] เพิ่ม alert "grid import > 1 kW ตอนกลางวัน" (กำลังซื้อไฟตอนแดดดี = ผิดปกติ)
- [ ] กราฟ inline ใน Telegram message (Chart.js → image)
- [ ] Daily summary 18:00 น. — สรุปวันนี้ผลิตได้ X kWh, ใช้ไป Y kWh
- [ ] Weekly summary วันอาทิตย์ 20:00 น.
- [ ] Quiet hours config (ไม่ส่งช่วง 22:00-06:00)
- [ ] Persistent state ใน Upstash Redis (Vercel Marketplace) — dedupe "ส่งเฉพาะตอนข้ามเส้น" แทนทุก 30 นาที
