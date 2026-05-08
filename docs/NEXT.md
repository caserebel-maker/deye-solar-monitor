# NEXT — Deye Solar Monitor

> Living handoff doc. Overwrite each session with current state.

---

## §0 TL;DR — ที่ต้องทำเครื่องถัดไป (Mac mini ที่บ้าน)

🔁 **ไปทำต่อบน Mac mini** — เปิด Claude Code ที่ folder repo นี้แล้วพิมพ์:

```
อ่าน docs/NEXT.md แล้วทำต่อ — เริ่มที่ §3.1 (Tapo CCTV setup, step 2)
```

ก่อนพิมพ์: `git pull origin main --ff-only`

---

## §1 ที่ทำไปแล้ว session นี้ (laptop, 2026-05-08)

| สิ่งที่ทำ | สถานะ |
|---|---|
| Pull 26 commits ที่ค้างจากออฟฟิศ | ✅ |
| ระบุ Tapo camera IP = `192.168.1.159` (Static IP เปิดอยู่) | ✅ |
| สร้าง docs/NEXT.md (อันนี้) | ✅ |

**ไม่ได้แก้ code** — แค่ pull + handoff doc

---

## §2 อะไรใช้งานได้แล้วตอนนี้

- Production: https://monitor-solar-inverter-deye-battery.vercel.app/
- Repo: https://github.com/caserebel-maker/deye-solar-monitor
- การ์ด **Tapo CCTV Monitor** มีอยู่แล้วในหน้า dashboard — แต่ยังโชว์ "Awaiting Tapo stream" เพราะ `NEXT_PUBLIC_CCTV_HLS_URL` ยังว่าง
- โค้ด CCTV: [app/page.tsx:538](app/page.tsx#L538) `CctvCard` → `CctvLivePlayer` ใช้ hls.js
- Doc setup ละเอียด: [docs/CCTV_SETUP.md](docs/CCTV_SETUP.md)

---

## §3 Priority — ที่ต้องทำต่อ

### §3.1 🔴 Tapo CCTV — setup pipeline (urgent, in progress)

**Pipeline:**
```
Tapo (192.168.1.159, RTSP)
  → Mac mini บ้าน: go2rtc แปลง RTSP→HLS + Tailscale Funnel เปิด HTTPS
  → Vercel app อ่าน NEXT_PUBLIC_CCTV_HLS_URL
  → <video> + hls.js เล่นในการ์ด
```

**Status checklist:**

- [x] เสียบปลั๊กกล้อง + ต่อ WiFi
- [x] รู้ IP กล้อง = `192.168.1.159` (Static IP เปิด, gateway 192.168.1.1)
- [ ] **(ทำต่อที่นี่)** Tapo app → Advanced Settings → **Camera Account** → ตั้ง username/password ใหม่ (ห้ามใช้รหัส cloud)
- [ ] ทดสอบ RTSP บน Mac mini ด้วย VLC: `rtsp://USER:PASS@192.168.1.159:554/stream1` — ต้องอยู่ WiFi เดียวกัน (192.168.1.x)
- [ ] ลง `go2rtc` บน Mac mini: `brew install go2rtc`
- [ ] สร้าง config `~/.config/go2rtc/go2rtc.yaml` ตาม [docs/CCTV_SETUP.md](docs/CCTV_SETUP.md) Step 2
- [ ] ทดสอบ go2rtc — เปิด `http://localhost:1984` เห็น stream "tapo"
- [ ] ทำ LaunchAgent ให้ go2rtc รัน 24/7
- [ ] ลง Tailscale บน Mac mini — `brew install --cask tailscale` + login
- [ ] เปิด MagicDNS + HTTPS Cert + Funnel ACL ใน Tailscale admin
- [ ] รัน `sudo tailscale funnel --bg --https=443 http://localhost:1984`
- [ ] ได้ HTTPS URL → `https://<machine>.<tailnet>.ts.net/api/stream.m3u8?src=tapo`
- [ ] ใส่ `NEXT_PUBLIC_CCTV_HLS_URL` ใน Vercel env (Prod + Preview + Dev)
- [ ] **Redeploy** — `NEXT_PUBLIC_*` ต้อง bake ตอน build
- [ ] เปิด dashboard → การ์ดเปลี่ยนเป็น live video พร้อมจุดเขียว "Live"

**Doc reference:** [docs/CCTV_SETUP.md](docs/CCTV_SETUP.md) มี step-by-step + troubleshooting ครบ

---

## §4 Env vars + endpoints (stable reference)

**Vercel project:** `monitor-solar-inverter-deye-battery`

**Env vars หลัก:**
- `DEYE_*` — Deye cloud API credentials (กำหนดแล้ว)
- `WEATHER_LAT=13.644809` / `WEATHER_LON=100.706098` — Open-Meteo
- `NEXT_PUBLIC_CCTV_HLS_URL` — **ยังไม่ได้ตั้ง** (จะตั้งหลัง Tailscale Funnel ขึ้น)

**Local network (สำคัญ — ต้องอยู่บ้านถึงเข้าถึงได้):**
- Camera IP: `192.168.1.159` (Tapo, Static IP)
- Gateway: `192.168.1.1`
- Mask: `255.255.255.0`

---

## §5 Git state

- Last commit: `0732a70` — Lighten weather chip fill, brighten chip border
- Branch: `main` (no worktree branches)
- Push pattern: `git push origin main` (direct push, solo work)

---

## §6 Quirks / lessons

- `NEXT_PUBLIC_*` env vars ต้อง redeploy ทุกครั้งที่เปลี่ยนค่า (bake ตอน build)
- Tapo Camera Account ต้อง**สร้างใหม่** — ไม่ใช่รหัส login Tapo cloud
- HLS latency 5-10 วิเป็นเรื่องปกติ — ถ้าต้อง real-time ใช้ WebRTC mode ของ go2rtc แทน
- Safari iOS ใช้ HLS native — ต้องเป็น HTTPS เท่านั้น (Tailscale Funnel ให้อยู่แล้ว)
