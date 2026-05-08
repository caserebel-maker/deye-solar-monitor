# NEXT — Deye Solar Monitor

> Living handoff doc. Overwrite each session with current state.

---

## §0 TL;DR

✅ **Tapo CCTV pipeline + Pan/Tilt control = LIVE + persistent**

- Live URL: https://monitor-solar-inverter-deye-battery.vercel.app/
- HLS: https://home-macmini.tail1d5579.ts.net/api/stream.m3u8?src=tapo
- PTZ proxy: https://home-macmini.tail1d5579.ts.net/control/ptz (Bearer-protected)
- การ์ด CCTV มี ↑ ↓ ← → + ปุ่มหยุด — ส่งคำสั่งผ่าน ONVIF ไปกล้อง Tapo C545D
- ทุก daemon (go2rtc, tailscaled, PTZ proxy) อยู่ใน LaunchAgent → auto-restart หลัง reboot

---

## §1 ที่ทำไปแล้ว session นี้ (Mac mini บ้าน, 2026-05-08)

### ส่วน 1 — HLS streaming (✅ persistent)

| ขั้นตอน | สถานะ |
|---|---|
| Clone repo → `/Volumes/C1TB/EB-CI/deye-solar-monitor` | ✅ |
| ตั้ง git `user.email = caserebel@gmail.com` (Vercel team rule) | ✅ |
| Tapo Camera Account (ทำใน Tapo app) — username `Pondsol@r1` | ✅ |
| go2rtc v1.9.14 binary → `/opt/homebrew/bin/go2rtc` | ✅ |
| Config `~/.config/go2rtc/go2rtc.yaml` (mode 600 — มี cred) | ✅ |
| LaunchAgent `~/Library/LaunchAgents/com.go2rtc.plist` (auto-start) | ✅ |
| `brew install tailscale` (formula CLI-only — ไม่ต้อง sudo) | ✅ |
| LaunchAgent `~/Library/LaunchAgents/com.tailscale.tailscaled.plist` (userspace) | ✅ |
| Tailscale Funnel + cert + serve mount `/` → :1984 | ✅ |
| Vercel `NEXT_PUBLIC_CCTV_HLS_URL` (Prod + Preview + Dev) | ✅ |
| `vercel deploy --prod` | ✅ |

### ส่วน 2 — PTZ control (✅ working + persistent)

| ขั้นตอน | สถานะ |
|---|---|
| Verify Tapo C545D supports ONVIF (port 2020) | ✅ |
| `uv` Python project ที่ `~/cctv-control/` (FastAPI + onvif-zeep) | ✅ |
| `~/cctv-control/server.py` — Bearer-auth PTZ proxy on :1985 | ✅ |
| Tailscale serve add `/control` mount → 127.0.0.1:1985 | ✅ |
| Vercel envs `CCTV_PTZ_TOKEN` (encrypted) + `CCTV_PTZ_ENDPOINT` (plain) | ✅ |
| `app/api/cctv/ptz/route.ts` — server-side proxy with bearer | ✅ |
| `<CctvPtzControls>` d-pad ในการ์ด CCTV | ✅ |
| `vercel deploy --prod` | ✅ |
| LaunchAgent `com.ebci.cctv-ptz` (ProcessType=Interactive + Aqua) | ✅ |
| **Note:** rotate token แล้ว 1 ครั้ง — token เก่าใน git history ใช้ไม่ได้ | ✅ |

---

## §2 Architecture ปัจจุบัน

```
                      ┌─────────────────────────────┐
                      │   Tapo C545D (192.168.1.159)│
                      │   • RTSP /stream1, /stream2 │
                      │   • ONVIF :2020 (PTZ)       │
                      └──────────────┬──────────────┘
                                     │ LAN
                ┌────────────────────┴────────────────────┐
                │  Mac mini บ้าน (192.168.1.136)           │
                │                                         │
                │  go2rtc :1984  ── LaunchAgent           │
                │   └─ rtsp ↔ HLS                         │
                │                                         │
                │  PTZ proxy :1985 ── nohup (TODO: agent) │
                │   └─ FastAPI + onvif-zeep + bearer auth │
                │                                         │
                │  tailscaled (userspace) ── LaunchAgent  │
                │   └─ funnel:                            │
                │      /        → localhost:1984          │
                │      /control → 127.0.0.1:1985          │
                └──────────────────┬──────────────────────┘
                                   │ Tailscale Funnel (HTTPS, Let's Encrypt)
                                   ▼
                  https://home-macmini.tail1d5579.ts.net
                       │                       │
                       ▼ /api/stream.m3u8      ▼ /control/ptz (Bearer)
                       │                       │
                       └───────┬───────────────┘
                               │
                  ┌────────────▼─────────────────┐
                  │ Vercel app (NEXT_PUBLIC_*)   │
                  │  • <CctvLivePlayer> + hls.js │
                  │  • POST /api/cctv/ptz        │
                  │     (token from server env)  │
                  └────────────┬─────────────────┘
                               ▼
                Browser ← user คุมกล้องได้
```

---

## §3 Health checks + known issues

### §3.1 Health-check (รันก่อนทุกอย่าง)

```bash
cd /Volumes/C1TB/EB-CI/deye-solar-monitor && bash scripts/cctv-health.sh
```

เช็ค 5 ชั้น (camera, go2rtc, tailscale+funnel, PTZ proxy, external HTTPS) + บอกคำสั่งแก้ทุก fail

### §3.2 PTZ proxy LaunchAgent (resolved)

**ปัญหาที่เคยเจอ:** macOS Tahoe (15.x+) Local Network privacy block process ที่
launchd เปิดเองจากการเข้าถึง 192.168.x.x — `tailscaled` + `go2rtc` ผ่านได้แต่
Python ใหม่ใน venv ไม่ inherit permission

**ที่แก้ในที่สุด:** เพิ่ม `ProcessType=Interactive` +
`LimitLoadToSessionType=[Aqua, Background, StandardIO]` ใน `com.ebci.cctv-ptz.plist`
ทำให้ macOS treat agent เป็น GUI-session process → permission grant ได้

ถ้าหายไปอีก:
```bash
launchctl kickstart -k gui/$UID/com.ebci.cctv-ptz
# ถ้ายังไม่ขึ้น → tail /tmp/cctv-ptz.err ดู error
```

### §3.3 Manual deep-dive

```bash
# PTZ test (จาก local — bypass Funnel + bearer)
# token อยู่ใน ~/cctv-control/.env (ห้าม commit token ลง git)
TOKEN=$(grep ^CCTV_PTZ_TOKEN= ~/cctv-control/.env | cut -d= -f2)
curl -s -X POST http://localhost:1985/ptz \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"direction":"right","duration_ms":300}'

# PTZ test (จาก public internet — ผ่าน Vercel API route + Funnel)
# ไม่ต้องใส่ token ที่นี่ — Vercel API route ใส่ให้ (server-side)
curl -s -X POST https://monitor-solar-inverter-deye-battery.vercel.app/api/cctv/ptz \
  -H 'content-type: application/json' \
  -d '{"direction":"left","duration_ms":300}'
```

---

## §4 Future enhancements

- [ ] **Basic auth บน dashboard** — ตอนนี้ public anyone with URL กด PTZ ได้
  - แนะนำ: NextAuth + Google OAuth (เฉพาะ caserebel@gmail.com / pondsuriya20@gmail.com)
- [ ] **Rate limit** บน `/api/cctv/ptz` — กัน flood spam
- [ ] **ONVIF Presets** — บันทึก preset positions (Home, Gate, Carport) + ปุ่ม jump
- [ ] **Velocity slider** — ปรับ speed PTZ ได้
- [ ] WebRTC mode ใน go2rtc (latency <1s แทน HLS 5–10s)
- [ ] go2rtc basic auth (`auth: "viewer:..."`) — กัน public ดู stream
- [ ] go2rtc `tapo://` source — ลองอีกครั้งเมื่อ go2rtc รองรับ KLAP protocol
  (FW Tapo C545D ใหม่ใช้ KLAP — go2rtc 1.9.14 ตอบ 401 ทุก variant ของ user/pass)

---

## §5 Env vars + endpoints (stable reference)

**Vercel project:** `monitor-solar-inverter-deye-battery-web` (id `prj_4Iua8s4gmeaGU7AplwkWixTvvIll`)
**Vercel team:** `suriyas-projects-d1b3e6b3` (caserebel@gmail.com — git author rule)

| Env | Type | Prod | Preview | Dev |
|---|---|---|---|---|
| `DEYE_*` | encrypted | ✅ | — | — |
| `NEXT_PUBLIC_CCTV_HLS_URL` | plain (public) | ✅ | ✅ | ✅ |
| `CCTV_PTZ_ENDPOINT` | plain (server-only) | ✅ | ✅ | ✅ |
| `CCTV_PTZ_TOKEN` | encrypted (server-only) | ✅ | ✅ | ✅ |

**Network (บ้าน):**
- Camera IP: `192.168.1.159` (Tapo C545D, FW 1.1.5, Static)
- Mac mini IP: `192.168.1.136` (PondM2pros-Mac-mini)
- Gateway: `192.168.1.1`
- Tailscale node: `home-macmini` (100.97.45.25)
- Tailnet: `tail1d5579.ts.net`
- DERP: Singapore (~39ms)

**Local files (มี cred — ห้าม commit):**
- `~/.config/go2rtc/go2rtc.yaml` (mode 600)
- `~/cctv-control/.env` (CCTV_PTZ_TOKEN + CAMERA_PASS)
- `~/.tailscale/tailscaled.sock` + state
- Cert/key Tailscale Funnel

---

## §6 Git state

- Push pattern: `git push origin main` (direct push)
- Branch: `main`
