# Deye Solar Monitor & CCTV Pipeline Handbook

ยินดีต้อนรับสู่ไฟล์คู่มือรวมแบบ Single-Source! ไฟล์นี้ได้รวบรวมเอกสารการติดตั้ง การจัดการ และสถานะของโปรเจกต์ Deye Solar Monitor และระบบกล้องวงจรปิด Tapo บน Mac mini มารวมไว้ในที่เดียว เพื่อให้คุณสามารถคัดลอกไฟล์นี้เพื่อนำไปเริ่มโปรเจกต์หรือเปิดการสนทนากับ AI ในห้องใหม่ได้อย่างครบถ้วน ไม่กระจัดกระจายครับ

---

## สารบัญ (Table of Contents)
1. **[Section 1: README (ภาพรวมและวิธีเริ่มโปรเจกต์)](#section-1---readme-ภาพรวมและวิธีเริ่มโปรเจกต์)**
2. **[Section 2: Walkthrough (บันทึกการแก้ปัญหามวลความร้อน M2 Pro ล่าสุด)](#section-2---walkthrough-บันทึกการแก้ปัญหามวลความร้อน-m2-pro-ล่าสุด)**
3. **[Section 3: CCTV Setup Guide (Tapo + go2rtc + Tailscale)](#section-3---cctv-setup-guide-tapo--go2rtc--tailscale)**
4. **[Section 4: One-Click Restart Guide (วิธีกดสั่ง Restart สตรีมปุ่มเดียว)](#section-4---one-click-restart-guide-วิธีกดสั่ง-restart-สตรีมปุ่มเดียว)**
5. **[Section 5: Stability Tuning (แก้อาการภาพกล้องหลุดบ่อย)](#section-5---stability-tuning-แก้อาการภาพกล้องหลุดบ่อย)**
6. **[Section 6: Solar Alerts (ระบบส่งการแจ้งเตือนทาง Telegram)](#section-6---solar-alerts-ระบบส่งการแจ้งเตือนทาง-telegram)**
7. **[Section 7: Next Action & Handoff (แผนงานและการควบคุมกล้อง 2 ตัว)](#section-7---next-action--handoff-แผนงานและการควบคุมกล้อง-2-ตัว)**

---

## Section 1 - README: ภาพรวมและวิธีเริ่มโปรเจกต์

เว็บแอป Next.js + TypeScript สำหรับ monitor ระบบ Solar Inverter Deye + Battery บนจอคอม/แท็บเล็ต โดยอ่านข้อมูลผ่าน server-side API routes เท่านั้น และ fallback เป็น mock data เมื่อยังไม่ได้ตั้งค่า Deye Cloud API

### Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- lucide-react

### วิธีเริ่มรัน (Run)
```bash
npm install
cp .env.example .env.local
npm run dev
```
เปิดหน้าเว็บที่ `http://localhost:3000`
*(หากยังไม่ใส่ค่า API ใน `.env.local` dashboard จะขึ้น `Mock data` และยังใช้งานได้ครบทั้ง cards, flow diagram, charts และ alarm log)*

### การกำหนดค่า Environment Variables
```bash
DEYE_API_BASE_URL=https://eu1-developer.deyecloud.com/v1.0
DEYE_APP_ID=
DEYE_APP_SECRET=
DEYE_API_KEY=
DEYE_USERNAME=
DEYE_EMAIL=
DEYE_PASSWORD=
DEYE_COMPANY_ID=0
DEYE_STATION_ID=
DEYE_DEVICE_ID=
DEYE_LOGGER_SN=
```
*(ห้ามทำการระบุความลับเหล่านี้ในโค้ดฝั่ง Frontend หรือ commit ไฟล์ `.env.local` เด็ดขาด)*

### โครงสร้าง API (API Architecture)
Frontend จะเรียกคุยเฉพาะ API Endpoint ภายในแอปพลิเคชัน:
- `GET /api/solar/overview`
- `GET /api/solar/history`
- `GET /api/solar/alarms`

ไฟล์ `lib/deye-api.ts` จะทำหน้าที่เป็น Service Layer กลางสำหรับ:
1. อ่านค่า Config จากฝั่ง Server
2. ตรวจสอบเงื่อนไขความพร้อมในการดึงข้อมูลจาก Deye Cloud API
3. ทำการขอ Token จาก Deye OpenAPI ด้วย `AppId/AppSecret` และรหัสผ่านที่แปลงเป็น SHA-256
4. ดึงข้อมูลจาก API จริง ได้แก่ `/v1.0/station/latest`, `/v1.0/station/history`, `/v1.0/station/alertList`
5. จัดรูปแบบ (Normalize) ข้อมูลผลลัพธ์ให้พร้อมสำหรับเอาไป Render ในลักษณะเดียวกัน
6. หากเกิดข้อผิดพลาดในการดึงข้อมูล จะเปลี่ยนมาดึงจาก Mock data อัตโนมัติ เพื่อไม่ให้หน้าเว็บล่ม

---

## Section 2 - Walkthrough: บันทึกการแก้ปัญหามวลความร้อน M2 Pro ล่าสุด

เราได้แก้ไขปัญหาในหน้าจอ Dashboard หมวด "System Thermal Status" ของเครื่อง **Mac mini M2 Pro** ที่ก่อนหน้านี้แสดงค่าเป็น `--` (ไม่มีตัวเลขอุณหภูมิและพัดลม) สำเร็จแล้ว

### รายละเอียดการแก้ไข
1. **ตรวจพิกัดปัญหา**: หน้า Dashboard ดึงสถานะ M2 Pro ผ่าน API ใน Tailscale Funnel: `https://home-macmini.tail1d5579.ts.net/control/healthz` ซึ่งชี้ไปยังระบบ FastAPI (`server.py` ที่พอร์ต `1985`) บนเครื่อง Mac mini M2 Pro
2. **หาสาเหตุ**: ตัว FastAPI เดิมทีไม่ได้ส่งอุณหภูมิหรือพัดลมกลับไป เนื่องจากบนสถาปัตยกรรม Apple Silicon (M-series) การดึงความร้อนผ่าน CLI มักจะต้องใช้สิทธิ์ `sudo` ซึ่งแอปพลิเคชันระบบปกติไม่สามารถสั่งงานได้
3. **ติดตั้ง iSMC Utility**: ติดตั้งโปรแกรม `ismc` ผ่าน Homebrew ซึ่งสามารถเข้าถึงเซนเซอร์ความร้อน Apple Silicon และความเร็วพัดลมผ่าน macOS APIs ส่วนตัวได้โดยไม่ต้องใช้สิทธิ์ root (`sudo`):
   ```bash
   brew tap dkorunic/tap
   brew install ismc
   ```
4. **อัปเดต API endpoint**: แก้ไขไฟล์ `/Users/pondm1/cctv-control/server.py` เพิ่มโค้ดที่เรียกใช้งาน `ismc` เพื่อแปลงค่าอุณหภูมิ CPU (`CPU Die Average`) และรอบพัดลม (RPM) ออกไปในฟิลด์ `temperatureC` และ `sensors`
5. **รีสตาร์ทบริการ**: ทำการรีสตาร์ท LaunchAgent `com.ebci.cctv-ptz` บน Mac mini:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.ebci.cctv-ptz.plist
   launchctl load ~/Library/LaunchAgents/com.ebci.cctv-ptz.plist
   ```
6. **ผลลัพธ์**: ปัจจุบันหน้า Dashboard สามารถแสดงผลตัวเลขอุณหภูมิ (เช่น `86° - 88°`) และรอบพัดลม (เช่น `1700 RPM`) ได้อย่างถูกต้องและแม่นยำแล้ว

---

## Section 3 - CCTV Setup Guide: Tapo + go2rtc + Tailscale

คู่มือสำหรับเชื่อมต่อกล้อง TP-Link Tapo เข้ากับการ์ด **Tapo CCTV Monitor** บนหน้า Dashboard

### โครงสร้างระบบ (Pipeline)
```
Tapo camera (RTSP, LAN)
   │
   ▼
Mac mini ที่บ้าน
  • go2rtc แปลง RTSP → HLS (พอร์ต 1984)
  • Tailscale Funnel เปิด HTTPS public เพื่อส่งภาพออกนอกบ้าน
   │
   ▼
https://<machine>.<tailnet>.ts.net/api/stream.m3u8?src=tapo
   │
   ▼
Vercel app อ่านค่าจาก env `NEXT_PUBLIC_CCTV_HLS_URL`
   │
   ▼
<video> + hls.js เล่นสดบนการ์ด Dashboard
```

### การตั้งค่ากล้อง Tapo (Step 1)
กล้อง Tapo ต้องระบุบัญชีผู้ใช้สำหรับกล้องโดยเฉพาะ (ไม่ใช่ password ที่ล็อกอิน Tapo app ปกติ)
1. เปิด **Tapo app** ในมือถือ → เลือกกล้อง → ไอคอนรูปเฟือง ⚙️
2. เข้าไปที่ **Advanced Settings** → **Camera Account**
3. ตั้งค่า **Username** และ **Password** ของกล้อง (สำหรับระบุในโค้ด go2rtc)
4. จดจำ **IP Address** ของกล้อง (เช็คได้จาก Advanced → Device Info)

*RTSP URL ของ Tapo จะมีรูปแบบดังนี้:*
- **HD**: `rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1`
- **SD**: `rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream2`

### การตั้งค่า go2rtc บน Mac mini (Step 2)
ติดตั้งโปรแกรม `go2rtc` ผ่าน Homebrew:
```bash
brew install go2rtc
```
สร้างไฟล์การตั้งค่าที่ `~/.config/go2rtc/go2rtc.yaml` ดังนี้:
```yaml
api:
  listen: ":1984"

streams:
  tapo: rtsp://CAMERA_USERNAME:CAMERA_PASSWORD@192.168.x.x:554/stream1
```
*(แทนที่ `CAMERA_USERNAME`, `CAMERA_PASSWORD`, และ `192.168.x.x` ด้วยค่าจริงของคุณ)*

ทำให้โปรแกรมทำงานตลอดเวลา (24/7) โดยสร้างไฟล์ `~/Library/LaunchAgents/com.go2rtc.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.go2rtc</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/go2rtc</string>
    <string>-config</string>
    <string>/Users/YOUR_USER/.config/go2rtc/go2rtc.yaml</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/go2rtc.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/go2rtc.err</string>
</dict>
</plist>
```
แล้วสั่งเปิดการทำงาน:
```bash
launchctl load ~/Library/LaunchAgents/com.go2rtc.plist
```

### การตั้งค่า Tailscale Funnel เพื่อส่งสตรีมออก public (Step 3)
1. เปิดใช้งาน **MagicDNS** และ **HTTPS Certificates** ในหน้า Admin Panel ของ Tailscale
2. เปิดสิทธิ์ Funnel ในไฟล์ ACLs เพิ่มเติม:
   ```json
   {
     "nodeAttrs": [
       {
         "target": ["YOUR_EMAIL@gmail.com"],
         "attr":   ["funnel"]
       }
     ]
   }
   ```
3. สั่งรัน Funnel ชี้ไปยังพอร์ตของ go2rtc:
   ```bash
   sudo tailscale funnel --bg --https=443 http://localhost:1984
   ```
4. ตรวจสอบ URL ที่ได้ (เช่น `https://macmini.YOUR-TAILNET.ts.net`) โดยใช้คำสั่ง `tailscale funnel status`

### การเชื่อมต่อพอร์ตเข้ากับ Vercel (Step 4)
ให้ระบุค่า HLS URL ลงไปใน Vercel Environment Variables:
* **Key**: `NEXT_PUBLIC_CCTV_HLS_URL`
* **Value**: `https://macmini.YOUR-TAILNET.ts.net/api/stream.m3u8?src=tapo`
* ** Environments**: ทำการ Redeploy บน Vercel เพื่อให้ตัวแปรมีผลในการสร้างหน้าเว็บสำเร็จ

---

## Section 4 - One-Click Restart Guide: วิธีกดสั่ง Restart สตรีมปุ่มเดียว

ในการแก้ปัญหาภาพค้างหรือเกิดปัญหาในระบบสตรีมโดยไม่ต้องพิมพ์คำสั่งยาวๆ บน Terminal

### ใช้งานด้วยแอปพลิเคชัน "Restart Tapo CCTV" (แนะนำ)
บนเครื่อง Mac mini ได้มีการสร้างแอปพลิเคชัน AppleScript สำเร็จรูปไว้ที่ `/Applications/Restart Tapo CCTV.app` เรียบร้อยแล้ว
* **วิธีใช้**: เข้าไปที่ Finder → Applications ลากตัวแอปพลิเคชัน **"Restart Tapo CCTV"** ไปวางไว้ที่ Dock เพื่อปักหมุด
* **การสั่งงาน**: เมื่อกดคลิกที่ไอคอนแอป ระบบจะรันสคริปต์แก้ไขและแสดง Notification สรุปผลสถานะ (เช่น 🔄 กำลังรีสตาร์ท... -> ✅ Pipeline พร้อมใช้งาน) ให้ทราบบนมุมหน้าจอภายใน 30 วินาที

### โครงสร้างขั้นตอนของสคริปต์รีสตาร์ท (`cctv-restart.sh`)
สคริปต์นี้จะจัดการสิ่งต่างๆ ดังนี้โดยไม่กระทบต่อไฟล์ข้อมูลหลัก:
1. รีสตาร์ท LaunchAgent `com.go2rtc` เพื่อเคลียร์ Buffer ภาพ
2. รีสตาร์ท LaunchAgent `com.tailscale.tailscaled`
3. สั่งตั้งค่า `tailscale up` และรัน `funnel` ให้พอร์ต 443 ชี้ไปที่ go2rtc อีกครั้ง
4. รีสตาร์ทบริการ PTZ proxy `com.ebci.cctv-ptz` บนพอร์ต 1985
5. รอ 8 วินาที แล้วรันการทดสอบระบบผ่าน `scripts/cctv-health.sh` เพื่อตรวจสอบการตอบกลับ

---

## Section 5 - Stability Tuning: แก้อาการภาพกล้องหลุดบ่อย

เอกสารการจูนระบบกล้อง Tapo C545D ให้มีความเสถียรสูงสุดและลดปัญหาภาพหยุดหมุนหรือสัญญาณหลุดบ่อยครั้ง

### 1. เร่งความถี่ระบบ Watchdog (เปลี่ยนจาก 5 นาที เป็น 60 วินาที)
Watchdog ปัจจุบันทำหน้าที่ตรวจสอบสถานะความพร้อมของสตรีม หากระบบพบปัญหา จะสั่งรีสตาร์ทสตรีมอัตโนมัติ การลดเวลามาที่ 60 วินาทีจะช่วยแก้ไขสัญญาณค้างได้ไวยิ่งขึ้น

> [!IMPORTANT]
> **ระบบความปลอดภัย macOS Tahoe กับเรื่อง Path**
> บนระบบปฏิบัติการเวอร์ชันใหม่ของ Mac ตัวควบคุมระบบ (`launchd`) จะทำการ **Block** สิทธิ์การทำงานของสคริปต์ที่พยายามสั่งงานจาก External Hard Drive หรือไดรฟ์ที่เป็นพาร์ทิชันภายนอก (`/Volumes/*`) แม้จะให้สิทธิ์ Full Disk Access แก่ Terminal ไปแล้วก็ตาม
> **การแก้ไข**: ให้ทำการย้ายไฟล์สคริปต์ระบบ CCTV ไปยังโฟลเดอร์ Home Directory (`~/cctv-scripts/`) แทน เพื่อหลีกเลี่ยงการถูกบล็อกสิทธิ์การเข้าถึง

ขั้นตอนการอัปเดต watchdog plist:
```bash
# 1. ย้ายสคริปต์ไปที่ Home Directory
mkdir -p ~/cctv-scripts
cp /Volumes/C1TB/EB-CI/deye-solar-monitor/scripts/cctv-{watchdog,restart,health}.sh ~/cctv-scripts/
chmod +x ~/cctv-scripts/*.sh

# 2. แก้ไขไฟล์ plist
PLIST=~/Library/LaunchAgents/com.ebci.cctv-watchdog.plist
plutil -replace StartInterval -integer 60 "$PLIST"
plutil -replace ProgramArguments -json '["/bin/bash","/Users/'"$USER"'/cctv-scripts/cctv-watchdog.sh"]' "$PLIST"

# 3. สั่ง Reload ค่าใหม่เข้าสู่ launchd
launchctl bootout "gui/$UID/com.ebci.cctv-watchdog" 2>/dev/null
launchctl bootstrap "gui/$UID" "$PLIST"
```

### 2. สลับเปลี่ยนจากช่องสัญญาณ HD (stream1) เป็น SD (stream2)
เนื่องจากกล้อง Tapo C545D ในช่อง HD สตรีมจะใช้ปริมาณแบนด์วิธเครือข่ายสูงและมักเกิดการหลุดของเฟรมข้อมูลได้ง่าย หากการเร่งความถี่ Watchdog ยังไม่สามารถจำกัดอาการหลุดได้ดีพอ แนะนำให้สลับมาใช้สัญญาณ SD ซึ่งเสถียรมากกว่าถึง 4 เท่า

แก้ไขไฟล์ `~/.config/go2rtc/go2rtc.yaml`:
```yaml
streams:
  # เปลี่ยนจาก stream1 (HD) มาเป็น stream2 (SD) เพื่อความเสถียรในการทำงานระยะยาว
  tapo: rtsp://CAMERA_USERNAME:CAMERA_PASSWORD@192.168.1.159:554/stream2
```
และสั่งรีเซ็ต go2rtc:
```bash
launchctl kickstart -k gui/$UID/com.go2rtc
```

---

## Section 6 - Solar Alerts: ระบบส่งการแจ้งเตือนทาง Telegram

ฟีเจอร์การจัดส่งข้อความรายงานปริมาณการผลิตไฟฟ้าโซลาร์และแผงพลังงานเข้าสู่ Telegram ทุก 30 นาที เฉพาะช่วงเวลาที่มีแดด (กรุงเทพฯ เวลา 07:30 – 16:30 น.)

### ตัวอย่างข้อความแจ้งเตือน (Telegram Message)
* **กรณีการผลิตสูงกว่าค่ามาตรฐาน (Over Threshold)**:
  ```
  ☀️ Solar > 4.0 kW
  
  ⚡ ตอนนี้ผลิต 2.81 kW ▲
  🏠 บ้านใช้ 0.94 kW
  💡 Surplus 1.87 kW — เปิดเครื่องใช้ไฟได้
  📊 วันนี้สะสม 14.2 kWh
  🔋 Battery 87%
  ```
* **กรณีการผลิตต่ำกว่าค่ามาตรฐาน (Under Threshold)**:
  ```
  🌤️ Solar < 4.0 kW
  
  ⚡ ตอนนี้ผลิต 1.42 kW ▼
  🏠 บ้านใช้ 1.85 kW
  📥 Import 0.43 kW — ดึงไฟจาก grid/battery
  📊 วันนี้สะสม 14.2 kWh
  🔋 Battery 87%
  ```

### วิธีการสมัครใช้งานระบบแจ้งเตือน (3 ขั้นตอน)
1. **สร้าง Telegram bot**:
   * ค้นหาและเข้าไปคุยกับ `@BotFather` ใน Telegram ส่งคำสั่ง `/newbot`
   * กำหนดชื่อแอปและ username (เช่น `ebci_solar_bot`) จะได้รับรหัส **Bot Token** กลับมา
2. **หาค่า Chat ID**:
   * เข้าแชตของ Bot ที่เพิ่งสร้างใหม่แล้วกดปุ่ม **Start** หรือส่งข้อความพิมพ์อะไรก็ได้ไปหาบอท
   * เรียกดูข้อมูลผ่าน URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   * ค้นหาค่าไอดีเลขลบหรือเลขบวกในหมวด `"chat": { "id": 123456789 }` จดตัวเลขนี้ไว้
3. **กำหนดค่าใน Vercel**:
   * เข้าหน้าเว็บ Vercel หรือใช้ CLI เพิ่มค่าตัวแปร:
     * `TELEGRAM_BOT_TOKEN`: Bot token
     * `TELEGRAM_CHAT_ID`: Chat ID
     * `CRON_SECRET`: รหัสสำหรับสิทธิ์เข้าถึงป้องกันบุคคลภายนอกสั่งรันระบบ
     * `SOLAR_ALERT_THRESHOLD_KW`: (ระบุตัวเลขเช่น 4.0 หรือ 3.0 สำหรับระดับ threshold ที่ต้องการให้เทียบค่า)

---

## Section 7 - Next Action & Handoff: แผนงานและการควบคุมกล้อง 2 ตัว

### รายละเอียดการทำงานของระบบกล้องตัวที่ 2
1. **ตรวจพบจุดเชื่อมต่อ**: ค้นพบว่าช่อง RTSP สำหรับสตรีมข้อมูลของเลนส์ตัวที่สอง (Lens B - เลนส์ซูมและหมุนได้ PTZ) ของ Tapo C545D คือ `/stream6` (สำหรับภาพ HD) และ `/stream7` (สำหรับภาพ SD)
2. **แก้ไขการดึงภาพ**: เพิ่มช่องทางสตรีม `tapo_lens_b` และ `tapo_lens_b_sd` ใน `go2rtc.yaml`
3. **ระบบสลับเลนส์หน้าเว็บ**: เพิ่มปุ่มสลับกล้องแบบ Lens A / Lens B หน้าเว็บ โดยปุ่มควบคุมการหมุนเลนส์ (PTZ Controls) จะโชว์ขึ้นมาเฉพาะยามที่เลือก Lens B เพื่อให้ผู้ใช้หมุนกล้องและเห็นผลลัพธ์ภาพขยับสดๆ ได้เลย

### การเชื่อมต่อเครือข่ายภายในบ้านปัจจุบัน (Network Matrix)
* **ไอพีตัวกล้อง**: `192.168.1.109` (เดิมคือ `.159` ย้ายมาใช้ไอพีใหม่แบบฟิกซ์เรียบร้อย)
* **ไอพีตัว Mac mini**: `192.168.1.136`
* **ข้อมูล Tailscale**: Host `home-macmini` ใน Tailnet `tail1d5579.ts.net`

### สิ่งที่สามารถปรับแต่งหรือทำเพิ่มได้ในอนาคต (Next Steps)
* [ ] **ระบบตรวจสอบความปลอดภัย (Auth)**: ใช้ NextAuth หรือ Google OAuth จำกัดสิทธิ์การดูข้อมูลเฉพาะอีเมลของผู้เกี่ยวข้องเท่านั้น
* [ ] **ระบบการหมุนกล้องตามพิกัดจำลอง (ONVIF Presets)**: เพิ่มปุ่มกดด่วนให้กล้องหันไปทิศที่ตั้งค่าไว้ล่วงหน้าทันที เช่น ประตูรั้ว, โรงจอดรถ, หลังบ้าน
* [ ] **ปรับปรุงความเร็วสตรีม (WebRTC mode)**: ปรับปรุงช่องทางส่งภาพจาก HLS (ดีเลย์ 5-10 วิ) เป็น WebRTC เพื่อลดดีเลย์ภาพลงเหลือต่ำกว่า 1 วินาที
* [ ] **แจ้งเตือนสถานะแบตเตอรี่**: เพิ่ม Telegram Alert แจ้งเตือนเมื่อความจุแบตเตอรี่สำรองเหลือต่ำกว่า 20%
