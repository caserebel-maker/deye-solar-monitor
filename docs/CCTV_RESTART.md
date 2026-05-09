# CCTV One-Click Restart

ทำให้กดปุ่มเดียวบน Mac mini แล้ว pipeline CCTV กลับมารันได้ทันที — แทนที่จะต้องพิมพ์คำสั่งใน terminal ทีละอัน

## TL;DR — 3 วิธี เลือกที่ชอบ

| วิธี | Setup ครั้งแรก | ใช้งาน |
|---|---|---|
| **A. Double-click .command** | ไม่ต้องตั้ง | เปิด Finder → double-click |
| **B. Apple Shortcut** | 2 นาที | กดปุ่ม Dock / menu bar / Cmd+ปุ่ม |
| **C. Dock app via Automator** | 3 นาที | คลิกไอคอนใน Dock |

---

## วิธี A — Double-click `.command` file ⭐ ง่ายสุด

ทำงานได้ทันทีหลัง `git pull` ไม่ต้องตั้งอะไรเพิ่ม

1. เปิด Finder ไป `/Volumes/.../deye-solar-monitor/scripts/`
2. **Double-click** `cctv-restart.command`
3. macOS จะเปิด Terminal รัน script ให้ → จบ

**ทำให้กดง่ายขึ้น:**
- ลาก `cctv-restart.command` ไป Desktop แล้ว **Cmd+L** ทำ alias (shortcut)
- หรือลากไป Dock ขวา (ฝั่ง Trash) — กลายเป็นปุ่ม
- เปลี่ยนไอคอน: Get Info (Cmd+I) → ลากภาพไอคอนใส่มุมซ้ายบน

**ข้อดี:** ทำงานทันที ไม่ต้อง setup
**ข้อเสีย:** เปิด Terminal มาด้วย (ดู log ได้ แต่กิน screen real estate)

---

## วิธี B — Apple Shortcut ⭐ Polish ที่สุด

Apple Shortcuts app มากับ macOS Monterey+ — เปิดมาใช้ได้เลย

### Setup (ครั้งเดียว, 2 นาที)

1. เปิดแอป **Shortcuts** (Cmd+Space → "Shortcuts")
2. กด **+** สร้างใหม่
3. ค้นหา **"Run Shell Script"** → ลากเข้ามา
4. ตั้งค่า:
   - Shell: `bash`
   - Pass Input: `to stdin`
   - Script:
     ```bash
     bash /Volumes/C1TB/EB-CI/deye-solar-monitor/scripts/cctv-restart.sh
     ```
     (เปลี่ยน path ให้ตรงกับ Mac mini ของคุณ — `pwd` ใน repo เพื่อหา path จริง)
5. ตั้งชื่อ Shortcut: **"CCTV Restart"**
6. กด ⓘ ขวาบน → ติ๊ก:
   - ☑ **Pin in Menu Bar** ← จะเห็นไอคอนบนแถบเมนู
   - ☑ **Use as Quick Action** (optional)
   - ☑ **Show in Share Sheet** (optional)
7. (Optional) Add Keyboard Shortcut: เช่น **⌘⇧R** → กดแล้วรันทันที

### ใช้งาน

- คลิกไอคอน Shortcuts ในแถบเมนู → "CCTV Restart"
- หรือ Spotlight: Cmd+Space → "CCTV Restart" → Enter
- หรือ keyboard shortcut ที่ตั้งไว้
- หรือ Siri: "Hey Siri, run CCTV Restart"

**ข้อดี:** ไม่เปิด Terminal, มี notification, integrate กับทุกที่
**ข้อเสีย:** ดู log ไม่ได้ทันที (ต้อง tail `/tmp/go2rtc.log` เอง)

---

## วิธี C — Automator app บน Dock

ถ้าอยากได้ "ไอคอนแอป" จริงๆ บน Dock เหมือนแอปทั่วไป

1. เปิด **Automator** (Cmd+Space → "Automator")
2. เลือก **Application**
3. ค้น **"Run Shell Script"** → ลากเข้า
4. Shell: `/bin/bash`
5. ใส่:
   ```bash
   bash /Volumes/C1TB/EB-CI/deye-solar-monitor/scripts/cctv-restart.sh
   ```
6. **File → Save** → ตั้งชื่อ "CCTV Restart" → save ใน `/Applications`
7. ไป `/Applications` หา CCTV Restart.app → ลากใส่ Dock

**เปลี่ยนไอคอน:**
- หา `.icns` หรือ `.png` ไอคอนสวยๆ
- ขวาคลิก app → Get Info → ลากไอคอนใหม่ใส่มุมซ้ายบนของหน้าต่าง info

---

## script ทำอะไรบ้าง

```
[1/5] go2rtc       — kickstart com.go2rtc LaunchAgent
[2/5] tailscaled   — kickstart com.tailscale.tailscaled LaunchAgent
[3/5] Tailscale    — tailscale up + funnel --https=443 → :1984
[4/5] PTZ proxy    — kickstart com.cctv.ptz LaunchAgent (หรือ spawn manual)
[5/5] รอ 8 วินาที + รัน scripts/cctv-health.sh
       → macOS notification: ✅ healthy / ⚠️ partial / ✗ failed
```

ไม่ทำลายอะไร — `kickstart -k` แค่ restart ของที่รันอยู่ ปลอดภัย รันบ่อยได้

---

## Troubleshooting

| อาการ | แก้ |
|---|---|
| Notification ไม่ขึ้น | System Settings → Notifications → "Script Editor" / "Shortcuts" → Allow |
| `tailscale: command not found` | check path `which tailscale` แล้วแก้ `TS_BIN` ใน script |
| `com.cctv.ptz LaunchAgent not found` | สร้าง plist ก่อน — ดู NEXT.md §1 ส่วน 2 หรือ spawn manual fallback ใน script |
| Apple Shortcut กดไม่รัน | System Settings → Privacy & Security → Automation → ติ๊ก Shortcuts → Terminal/System Events |
| double-click .command ขึ้น "cannot be opened" | Right-click → Open (ครั้งแรก macOS Gatekeeper ถาม) |

---

## ไอเดียเพิ่ม

- **Auto-recover loop** — cron ทุก 5 นาที เช็ค `cctv-health.sh` ถ้า fail ให้รัน restart อัตโนมัติ
- **Stream Deck button** — ถ้ามี Stream Deck → ตั้งปุ่มยิง shortcut
- **iPhone Shortcut** — สร้าง Shortcut บนมือถือ ssh เข้า Mac mini รัน script (ผ่าน Tailscale SSH)
- **Webhook จาก Vercel** — ถ้า production ตรวจ stream offline 3 ครั้ง → trigger Mac mini ผ่าน Tailscale Funnel webhook → restart auto

ดู §5 ใน `docs/NEXT.md` ถ้าจะทำต่อ
