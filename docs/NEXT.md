# NEXT — Deye Solar Monitor

> Living handoff doc. Overwrite each session with current state.

---

## §0 TL;DR — เลือก 1 path เมื่อปอนด์ตื่นบ่ายๆ

🚧 **Pipeline ทำงานแล้วทุกชั้น** — แต่ค้นพบว่า **Tapo C545D เป็น dual-lens จริง**:

| Lens | Stream ผ่าน RTSP/ONVIF | PTZ control |
|---|---|---|
| **A** — close-up basket (fixed) | ✅ ใช้อยู่ตอนนี้ | ❌ ไม่ขยับ |
| **B** — wide outdoor (motorized) | ❌ KLAP-encrypted (Tapo proprietary) | ✅ ขยับเมื่อกดปุ่ม |

ปัจจุบัน dashboard แสดง stream ของ **Lens A** + ปุ่ม PTZ ส่งคำสั่งไปขยับ **Lens B** (เห็นใน Tapo app เท่านั้น) → คนใช้งานสับสน

**4 paths ให้เลือก** — รายละเอียดใน §3 — แนะนำลอง **A → C** ตามลำดับ:

- **A.** ใช้ pytapo bridge stream Lens B ผ่าน KLAP (รอ cool-down 30 min)
- **B.** ปล่อย state ปัจจุบัน (toggle Lens 1/Lens 2 ที่ confused)
- **C.** Single-lens + relabel PTZ ให้ honest ✅ **patch พร้อม merge บน branch `path-c/single-lens-with-relabel`**
- **D.** ติดกล้องตัวที่ 2 (Tapo C200/C210 fixed outdoor) — ใช้ RTSP standard

---

## §1 ที่ทำไปแล้ว session นี้ (Mac mini บ้าน)

### ส่วน 1 — HLS streaming (✅ persistent)

| ขั้นตอน | สถานะ |
|---|---|
| go2rtc + LaunchAgent | ✅ |
| Tailscale Funnel + LaunchAgent (userspace) | ✅ |
| Vercel `NEXT_PUBLIC_CCTV_HLS_URL` ครบ 3 envs | ✅ |
| Production deploy | ✅ |
| hls.js auto-reconnect on fatal errors | ✅ |
| Force `.play()` on MANIFEST_PARSED (Brave autoplay) | ✅ |

### ส่วน 2 — PTZ control (✅ ขยับ Lens B จริง)

| ขั้นตอน | สถานะ |
|---|---|
| ONVIF probe (port 2020) | ✅ |
| `~/cctv-control` Python project (FastAPI + onvif-zeep) | ✅ |
| PTZ proxy `:1985` + LaunchAgent (ProcessType=Interactive) | ✅ |
| Tailscale serve mount `/control` → :1985 | ✅ |
| Vercel envs `CCTV_PTZ_TOKEN` (encrypted) + `CCTV_PTZ_ENDPOINT` (plain) | ✅ |
| `app/api/cctv/ptz/route.ts` server-side bearer proxy | ✅ |
| `<CctvPtzControls>` d-pad ในการ์ด | ✅ |

### ส่วน 3 — Weather forecast

| ขั้นตอน | สถานะ |
|---|---|
| Add `is_day` flag → Moon icons ตอนกลางคืน | ✅ |

### ส่วน 4 — Lens toggle (deployed but misleading)

| ขั้นตอน | สถานะ |
|---|---|
| Lens 1/Lens 2 toggle in CctvCard | ⚠️ deployed but `tapo` and `tapo_sd` are HD/SD ของ Lens A เดียวกัน |
| Lens 2 ภาพไม่ขึ้นจริงๆ (= แค่ SD ของ Lens A; user รายงานว่าไม่มีภาพ) | ⚠️ |

---

## §2 Architecture ปัจจุบัน

```
                      ┌───────────────────────────────────────────┐
                      │   Tapo C545D (192.168.1.159, dual-lens)    │
                      │   • Lens A (fixed)  → RTSP /stream1,/stream2 │
                      │   • Lens B (PTZ)    → Tapo KLAP only        │
                      │   • ONVIF :2020 PTZ controls Lens B         │
                      └──────────────┬─────────────────────────────┘
                                     │ LAN
                ┌────────────────────┴────────────────────┐
                │  Mac mini บ้าน (192.168.1.136)            │
                │  go2rtc :1984 (LaunchAgent)              │
                │   └─ tapo, tapo_sd (both = Lens A)       │
                │  PTZ proxy :1985 (LaunchAgent)           │
                │   └─ ONVIF ContinuousMove + Stop         │
                │  tailscaled userspace (LaunchAgent)      │
                │   └─ funnel:                             │
                │      /        → :1984                    │
                │      /control → :1985                    │
                └──────────────────┬───────────────────────┘
                                   │ Funnel HTTPS
                                   ▼
                  https://home-macmini.tail1d5579.ts.net
                       │                       │
                       ▼ /api/stream.m3u8      ▼ /control/ptz (Bearer)
                       │                       │
                  ┌────┴───────────────────────┴────┐
                  │ Vercel app (NEXT_PUBLIC_*)      │
                  │  • <CctvLivePlayer> + hls.js    │
                  │  • POST /api/cctv/ptz           │
                  └─────────────┬───────────────────┘
                                ▼
                Browser (Lens A view + PTZ ขยับ Lens B)
```

---

## §3 Decision paths (ตอนตื่นเลือก 1 อัน)

### §3.1 Path A — pytapo bridge to Lens B over KLAP

**สถานะ:** กล้องใน cool-down (30 min) จาก probe ก่อนหน้า — ปลอดภัย retry **หลัง 02:01 AM** (Bangkok time)

**ทดสอบ:**
```bash
cd ~/cctv-control && uv run python probe_klap.py
```

Script ลอง credential 5 variants:
1. cloud email + cloud pass
2. cloud user (no @gmail) + cloud pass
3. admin + cloud pass
4. admin + camera pass
5. camera account

**ถ้า success:**
- Output มี `t.getStreamUrl(2)` หรือ `getCamera2Stream()` → URL ที่ใช้ได้
- Add ใน `~/.config/go2rtc/go2rtc.yaml`:
  ```yaml
  streams:
    tapo: <url ของ lens A เดิม>
    tapo_lens_b: <url จาก probe>
  ```
- `launchctl kickstart -k gui/$UID/com.go2rtc`
- Update Vercel env `NEXT_PUBLIC_CCTV_HLS_URL` ให้ `?src=tapo_lens_b`
- redeploy

**ถ้า fail (likely — C545D firmware 1.1.5 = KLAP-only):** ไป Path C

### §3.2 Path B — keep current (ไม่แนะนำ)

Lens 1/Lens 2 toggle ปัจจุบัน — Lens 2 ไม่มีภาพ (user รายงาน) เพราะมัน = SD ของ Lens A เดียวกัน confusing

ไม่ทำอะไร = state นี้

### §3.3 Path C — single lens + relabel PTZ ✅ พร้อม merge

**Branch:** `path-c/single-lens-with-relabel` (commit `108ceb3`, ยังไม่ push)

**Diff:** ลบ toggle, เพิ่ม caption "Lens A · close-up", PTZ panel เปลี่ยนเป็น "Pan / Tilt — Lens B" + helper "ขยับเลนส์ wide · ดู feed ใน Tapo app"

**Apply:**
```bash
cd /Volumes/C1TB/EB-CI/deye-solar-monitor
git checkout main
git merge path-c/single-lens-with-relabel
git push origin main
vercel deploy --prod --yes
# auto-aliased to production
```

### §3.4 Path D — เพิ่มกล้องตัวที่ 2

**ติดกล้อง Tapo C200 / C210 (fixed indoor) ที่จุด outdoor:**
- Set Camera Account → ได้ RTSP URL → add ใน `go2rtc.yaml` เป็น `tapo_outdoor:`
- Vercel: เพิ่ม env `NEXT_PUBLIC_CCTV_HLS_URL_OUTDOOR` + UI ให้ user toggle
- หรือ split ออกเป็น 2 cards (indoor / outdoor)

ค่ากล้อง C200/C210 ~700-1200 บาท

---

## §4 Health checks

```bash
cd /Volumes/C1TB/EB-CI/deye-solar-monitor && bash scripts/cctv-health.sh
```

ปัจจุบัน: ALL GREEN 5/5 — ตอน user ตื่นน่าจะยังเขียวอยู่ ถ้าไม่เขียวลองรันแก้ตามคำสั่งที่ script แนะนำ

---

## §5 Future enhancements (ไม่เร่ง)

- [ ] Basic auth บน dashboard (NextAuth + Google OAuth limited to caserebel@gmail.com / pondsuriya20@gmail.com)
- [ ] Rate limit `/api/cctv/ptz`
- [ ] ONVIF Presets (Home / Gate / Carport)
- [ ] Velocity slider PTZ
- [ ] WebRTC mode (latency <1s)
- [ ] go2rtc basic auth (`auth: viewer:...`)

---

## §6 Env vars (stable reference)

**Vercel project:** `monitor-solar-inverter-deye-battery-web` (id `prj_4Iua8s4gmeaGU7AplwkWixTvvIll`)
**Vercel team:** `suriyas-projects-d1b3e6b3` (caserebel@gmail.com — git author rule)

| Env | Type | Prod | Preview | Dev |
|---|---|---|---|---|
| `DEYE_*` | encrypted | ✅ | — | — |
| `NEXT_PUBLIC_CCTV_HLS_URL` | plain | ✅ | ✅ | ✅ |
| `CCTV_PTZ_ENDPOINT` | plain | ✅ | ✅ | ✅ |
| `CCTV_PTZ_TOKEN` | encrypted | ✅ | ✅ | ✅ |

**Network (บ้าน):**
- Camera IP: `192.168.1.159` (Tapo C545D, FW 1.1.5)
- Mac mini IP: `192.168.1.136` (PondM2pros-Mac-mini)
- Tailscale node: `home-macmini` (100.97.45.25)
- Tailnet: `tail1d5579.ts.net`

**Local files (มี cred — ห้าม commit):**
- `~/.config/go2rtc/go2rtc.yaml` (RTSP creds, mode 600)
- `~/cctv-control/.env` (CCTV_PTZ_TOKEN, CAMERA_PASS, TAPO_CLOUD_PASS, mode 600)
- `~/cctv-control/probe_klap.py` (Path A probe script)
- `~/.tailscale/` (state files)

---

## §7 Git state

- Branch `main`: lens toggle deploy (commit `2c29980`) — currently aliased to production
- Branch `path-c/single-lens-with-relabel` (commit `108ceb3`): Path C ready
- Push pattern: `git push origin main`
