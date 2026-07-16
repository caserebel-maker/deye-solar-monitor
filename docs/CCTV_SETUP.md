# CCTV Setup (Tapo + go2rtc + Tailscale Funnel)

ขั้นตอนเชื่อมกล้อง TP-Link Tapo เข้ากับการ์ด **Tapo CCTV Monitor** ใน dashboard

**Pipeline ที่จะวาง:**

```
Tapo camera (RTSP, LAN)
   │
   ▼
Mac mini ที่บ้าน
  • go2rtc แปลง RTSP → HLS
  • Tailscale Funnel เปิด HTTPS public
   │
   ▼
https://<machine>.<tailnet>.ts.net/api/stream.m3u8?src=tapo
   │
   ▼
Vercel app อ่าน NEXT_PUBLIC_CCTV_HLS_URL / _2 / _3
   │
   ▼
<video> + hls.js เล่นในการ์ด
```

---

## สิ่งที่ต้องมี

- [ ] กล้อง TP-Link Tapo ที่รองรับ RTSP (C200, C210, C220, C320WS, C520WS, ฯลฯ)
- [ ] Mac mini ที่บ้าน เปิด 24/7 ต่อ LAN เดียวกับกล้อง
- [ ] บัญชี [Tailscale](https://tailscale.com) (ฟรีสำหรับ solo)
- [ ] สิทธิ์แก้ env vars ใน Vercel project

---

## Step 1 — เปิด RTSP ในกล้อง Tapo

Tapo RTSP ต้องสร้าง **Camera Account** แยกจาก TP-Link Cloud (ไม่ใช่ password ที่ใช้ login Tapo app)

1. เปิด **Tapo app** → เลือกกล้อง → ไอคอน ⚙️ มุมขวาบน
2. กด **Advanced Settings** → **Camera Account**
3. ตั้ง **Username** + **Password** (จดไว้ — จะใช้ใน go2rtc)
4. กลับเมนู Advanced → ดู **Device Info** → จด **IP Address** ของกล้อง
   - ถ้าไม่เห็น IP: ดูที่ router admin page ในหัวข้อ DHCP clients มองหาชื่อกล้อง
   - หรือใช้ tool เช่น [Fing](https://www.fing.com) บนมือถือสแกน LAN

**RTSP URL pattern ของ Tapo:**

```
rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1   # HD
rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream2   # SD (ใช้ bandwidth น้อยกว่า)
```

**ทดสอบ:** เปิดด้วย VLC (`File > Open Network`) วาง URL — ถ้าเห็นภาพคือ OK

---

## Step 2 — ติดตั้ง go2rtc บน Mac mini

go2rtc คือ stream gateway เบา ๆ — แปลง RTSP → HLS / WebRTC

```bash
# ติดตั้งผ่าน Homebrew
brew install go2rtc

# หรือ download binary จาก releases:
# https://github.com/AlexxIT/go2rtc/releases
```

สร้าง config ที่ `~/.config/go2rtc/go2rtc.yaml`:

```yaml
api:
  listen: ":1984"

streams:
  tapo: rtsp://CAMERA_USERNAME:CAMERA_PASSWORD@192.168.x.x:554/stream1

# ปลอดภัยขึ้น: เพิ่ม basic auth ป้องกันคนอื่นเข้า stream
# auth ทำงานหลัง expose ผ่าน Tailscale แล้ว — ใส่ก็ได้ไม่ใส่ก็ได้
# auth:
#   "viewer:CHANGE_ME": ""
```

แทน `CAMERA_USERNAME`, `CAMERA_PASSWORD`, `192.168.x.x` ด้วยค่าจริง

**ทดสอบ:**

```bash
go2rtc -config ~/.config/go2rtc/go2rtc.yaml
```

เปิด browser → `http://localhost:1984` — ควรเห็น stream "tapo" → กด **stream** เห็นภาพ → OK

**ทำให้รัน 24/7 (LaunchAgent):**

สร้าง `~/Library/LaunchAgents/com.go2rtc.plist`:

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

โหลด:

```bash
launchctl load ~/Library/LaunchAgents/com.go2rtc.plist
```

---

## Step 3 — Tailscale Funnel เปิด HTTPS public

[Tailscale](https://tailscale.com) สร้าง mesh VPN + **Funnel** ให้ public HTTPS endpoint จากเครื่องใน mesh

```bash
# ติดตั้ง
brew install --cask tailscale

# เปิดแอป → login

# เช็คว่าออนไลน์
tailscale status

# เปิด HTTPS (ครั้งแรก — หลังจากนี้ใช้ทุก funnel)
tailscale cert
```

**Enable Funnel ใน admin panel** (ครั้งเดียวต่อ tailnet):
- ไปที่ https://login.tailscale.com/admin/dns
- เปิด **MagicDNS** + **HTTPS Certificates**
- ไปที่ https://login.tailscale.com/admin/acls
- ในไฟล์ ACL เพิ่ม:

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

(หรือ target เป็น `*` ถ้าใช้คนเดียว)

**Expose go2rtc:**

```bash
sudo tailscale funnel --bg --https=443 http://localhost:1984
```

ดู URL ที่ได้:

```bash
tailscale funnel status
```

จะได้ URL แบบ:

```
https://macmini.YOUR-TAILNET.ts.net
```

**ทดสอบ:** เปิดบนมือถือ 4G (ปิด WiFi) — เข้า URL ได้ + เห็นหน้า go2rtc

---

## Step 4 — ใส่ HLS URL ใน Vercel

HLS endpoint ของ go2rtc คือ:

```
https://macmini.YOUR-TAILNET.ts.net/api/stream.m3u8?src=tapo
```

**ใส่ใน Vercel:**

1. ไปที่ https://vercel.com → project `monitor-solar-inverter-deye-battery`
2. **Settings** → **Environment Variables**
3. เพิ่ม:
   - **Key:** `NEXT_PUBLIC_CCTV_HLS_URL`
   - **Value:** URL จากด้านบน
   - **Environments:** Production + Preview + Development
4. ถ้ามีกล้องเพิ่ม ให้เพิ่ม URL แยก:
   - `NEXT_PUBLIC_CCTV_HLS_URL` = กล้องหลักเดิม
   - `NEXT_PUBLIC_CCTV_HLS_URL_2` = กล้อง DLC / ตัวที่สอง
   - `NEXT_PUBLIC_CCTV_HLS_URL_3` = กล้องใหม่ที่จะขึ้นเป็นใบแรก
5. ถ้าต้องใช้ PTZ ให้ใส่ IP LAN ของกล้องด้วย:
   - `NEXT_PUBLIC_CCTV_CAMERA_IP`
   - `NEXT_PUBLIC_CCTV_CAMERA_IP_2`
   - `NEXT_PUBLIC_CCTV_CAMERA_IP_3`
6. กด **Save**
7. **Deployments** → กดเมนู ⋮ ของ deployment ล่าสุด → **Redeploy** (ต้อง redeploy เพราะ `NEXT_PUBLIC_*` ต้อง bake ตอน build)

**ใส่ใน .env.local (สำหรับ dev เครื่องตัวเอง):**

```bash
NEXT_PUBLIC_CCTV_HLS_URL=https://macmini.YOUR-TAILNET.ts.net/api/stream.m3u8?src=tapo
NEXT_PUBLIC_CCTV_HLS_URL_2=https://macmini.YOUR-TAILNET.ts.net/api/stream.m3u8?src=tapo_2
NEXT_PUBLIC_CCTV_HLS_URL_3=https://macmini.YOUR-TAILNET.ts.net/api/stream.m3u8?src=tapo_3
NEXT_PUBLIC_CCTV_CAMERA_IP=192.168.1.109
NEXT_PUBLIC_CCTV_CAMERA_IP_2=192.168.1.106
NEXT_PUBLIC_CCTV_CAMERA_IP_3=192.168.1.xxx
```

---

## Step 5 — เปิด dashboard ดู

หลัง Vercel redeploy:

- การ์ด **Tapo CCTV Monitor** จะเปลี่ยนจาก "Awaiting stream" → live `<video>` element
- มุมซ้ายบนของการ์ดเป็นจุดสีเขียวกะพริบ + คำว่า "Live"
- ถ้า stream offline จะขึ้น "Stream offline" + reason

---

## Troubleshooting

| ปัญหา | แก้ |
|---|---|
| VLC เปิด RTSP ไม่ได้ | username/password ไม่ตรง — เช็ค Camera Account ใน Tapo app |
| go2rtc ขึ้น "connect: connection refused" | IP กล้องผิด / กล้อง offline / firewall block port 554 |
| Tailscale Funnel ขึ้น 502 | go2rtc ยังไม่รัน หรือ port ใน funnel command ผิด |
| ใน browser มี cors error | go2rtc default มี CORS อนุญาต — ถ้ายังเจอ เพิ่ม `--cors=*` ใน config |
| `<video>` ขึ้น error fragLoadError | URL HLS ผิด หรือ go2rtc ไม่ตอบ — เปิด URL ตรง ๆ ใน browser ดู |
| ดูบน iPhone Safari ไม่ขึ้น | Safari ใช้ HLS native แทน hls.js — ต้องการ HTTPS เท่านั้น (Funnel ของเราเป็น HTTPS อยู่แล้ว ผ่าน) |
| Latency 5-10 วินาที | ปกติของ HLS — ถ้าต้องการต่ำกว่า 1 วิ ใช้ WebRTC แทน (โหมด `webrtc` ของ go2rtc) |

---

## Security note

- Tailscale Funnel เปิด stream เป็น **public anyone with URL** (ไม่ต้องผ่าน auth)
- ถ้ากังวล ให้เปิด basic auth ใน go2rtc config (ดูใน Step 2)
- หรือใช้ **Cloudflare Tunnel + Cloudflare Access** แทน — ซับซ้อนกว่า แต่มี SSO

---

## Reference

- [go2rtc docs](https://github.com/AlexxIT/go2rtc#readme)
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/funnel)
- [Tapo RTSP setup (TP-Link)](https://www.tp-link.com/us/support/faq/2680/)
- [hls.js docs](https://github.com/video-dev/hls.js#readme)
