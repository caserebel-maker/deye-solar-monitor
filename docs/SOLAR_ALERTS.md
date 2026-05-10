# Solar Production Alerts (Telegram)

แจ้งเตือนทาง Telegram เมื่อ solar **กำลังผลิตตอนนี้** เกิน threshold (default 2.5 kW)

## ภาพรวม

```
Vercel Cron (every hour at :00)
   │
   ▼
GET /api/cron/solar-threshold
   │ (verify CRON_SECRET)
   ▼
getSolarOverview() จาก Deye API
   │
   ├─ power < threshold → log + return (ไม่ส่ง)
   │
   └─ power ≥ threshold → sendTelegramMessage() → Telegram บน iPhone/มือถือ
```

ทุกชั่วโมง ถ้ายังเกินก็ยังส่งซ้ำ — design ตาม user request

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

```
☀️ *Solar ผลิตเกิน 2.5 kW*

⚡ ตอนนี้ผลิต *2.81 kW*
🏠 บ้านใช้ *0.94 kW*
💡 Surplus *1.87 kW* — เปิดเครื่องใช้ไฟได้สบาย
📊 วันนี้สะสม *14.2 kWh*
🔋 Battery *87%*

[เปิด dashboard](https://monitor-solar-inverter-deye-battery.vercel.app/)
```

---

## ปรับ behavior

### เปลี่ยน threshold
```bash
echo "3.0" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production --force
```

### ลด/เพิ่มความถี่
แก้ `vercel.json`:
```json
{ "schedule": "*/30 * * * *" }   // ทุก 30 นาที
{ "schedule": "0 6-18 * * *" }   // ทุก ชม. แต่ 6 AM - 6 PM เท่านั้น
{ "schedule": "0 */2 * * *" }    // ทุก 2 ชม.
```

แล้ว `git commit + push` deploy ใหม่

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
| ส่งทุก ชม. รำคาญ | เปลี่ยน schedule เป็น `0 6-18 * * *` เฉพาะกลางวัน |
| อยาก mute ตอนกลางคืน | Telegram client → silence chat กับ bot ตอนนอน |

---

## Future enhancements

- [ ] เพิ่ม alert "battery < 20%" ส่งเตือน
- [ ] เพิ่ม alert "grid import > 1 kW ตอนกลางวัน" (กำลังซื้อไฟตอนแดดดี = ผิดปกติ)
- [ ] กราฟ inline ใน Telegram message (Chart.js → image)
- [ ] Daily summary 18:00 น. — สรุปวันนี้ผลิตได้ X kWh, ใช้ไป Y kWh
- [ ] Weekly summary วันอาทิตย์ 20:00 น.
- [ ] Quiet hours config (ไม่ส่งช่วง 22:00-06:00)
- [ ] Persistent state ใน Upstash Redis (Vercel Marketplace) — dedupe "ส่งเฉพาะตอนข้ามเส้น" แทนทุกชั่วโมง
