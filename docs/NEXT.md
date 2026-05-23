# NEXT — Deye Solar Monitor

> Living handoff doc. Overwrite each session with current state.

---

## §0 🔁 สถานะปัจจุบัน — Mac mini session 2026-05-23 13:15 +07

### งาน (ก) ภาพ CCTV 2 เลนส์และปุ่มควบคุม — ✅ เสร็จเรียบร้อย
1. ✅ ค้นพบ RTSP stream path สำหรับเลนส์ตัวที่สอง (Lens B - PTZ Telephoto) คือ `/stream6` (HD) และ `/stream7` (SD)
2. ✅ อัปเดต `go2rtc.yaml` เพิ่ม `tapo_lens_b` และ `tapo_lens_b_sd`
3. ✅ เพิ่มปุ่มสลับ Lens A / Lens B บนหน้าเว็บ Dashboard
4. ✅ กู้คืนแผงควบคุมการหมุนกล้อง (PTZ controls /api/cctv/ptz) กลับมาใช้งานได้จริง โดยจะแสดงผลเฉพาะเวลาสลับมาดู Lens B (PTZ) เพื่อให้ผู้ใช้กดหมุนกล้องและเห็นภาพขยับในหน้า Dashboard ได้ทันที
5. ✅ เพิ่มการควบคุมกล้องตัวที่สอง (DLC) พร้อมสลับเลนส์ A/B และหมุนกล้องได้อิสระ โดยเชื่อมต่อผ่าน dynamic routing ใน backend
6. ✅ รัน typecheck และ build ผ่านในระบบเรียบร้อยแล้ว

### งาน (ข) ภาพ CCTV หายหลายนาที — ✅ Step 1-2 เสร็จ (ก่อนหน้านี้)

### งาน (ข) Telegram alert — ✅ live แล้ว

| ขั้น | สถานะ |
|---|---|
| สร้าง bot `@Solar725Sys_bot` (display "725 SolarSystem") | ✅ |
| Vercel envs `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `CRON_SECRET` (encrypted, all 3 envs) | ✅ |
| Production deploy (commit `93c37c6`) | ✅ |
| Vercel cron section ลบ (Hobby plan limit) | ✅ |
| Mac mini LaunchAgent `com.ebci.solar-alert` (StartInterval 1800s) | ✅ loaded |
| `/Users/pondm1/cctv-scripts/solar-alert-tick.sh` + `.solar-alert-secret` (mode 600) | ✅ |
| Test endpoint (Bearer) → response `{ok:true, skipped:"outside daylight window"}` | ✅ |

**พรุ่งนี้ 07:30 BKK** → message แรก จะส่งมาทาง Telegram ของปอนด์

ถ้าอยาก test ทันทีก่อนรอกลางวัน:
```bash
# Lower threshold to 0.1 kW temporarily
echo "0.1" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production --force
# Override end time to 23:59
echo "23:59" | npx vercel env add SOLAR_ALERT_TIME_END production --force
npx vercel deploy --prod --yes
# Tick manually
SECRET=$(cat ~/cctv-scripts/.solar-alert-secret)
curl -H "Authorization: Bearer $SECRET" \
  https://monitor-solar-inverter-deye-battery.vercel.app/api/cron/solar-threshold
# revert ค่าเดิมหลัง test
```

---

## §0.0 งาน (ข) — Setup Telegram alert solar > 4.0 kW

ที่เตรียมไว้บน laptop session แล้ว (commit ก่อนหน้านี้):
- `app/api/cron/solar-threshold/route.ts` — cron handler
- `lib/telegram.ts` — bot send helper
- `vercel.json` — schedule `*/30 * * * *` (ทุก 30 นาที, route filter เฉพาะ BKK 07:30–16:30 = ~19 msg/วัน)
- `docs/SOLAR_ALERTS.md` — guide เต็ม

**ที่ Mac mini ต้องทำ:**

### Setup #1 — สร้าง Telegram bot (~2 นาที)
- Telegram → `@BotFather` → `/newbot` → ตั้งชื่อ + username (ลงท้าย `_bot`)
- เก็บ **Bot Token** ไว้
- เปิด chat กับ bot ที่สร้าง → กด Start
- เปิด `https://api.telegram.org/bot<TOKEN>/getUpdates` → จด **chat_id**

### Setup #2 — ใส่ env vars ใน Vercel (~1 นาที)
```bash
cd <path-to-deye-solar-monitor>
echo "<BOT_TOKEN>"  | npx vercel env add TELEGRAM_BOT_TOKEN  production preview development
echo "<CHAT_ID>"    | npx vercel env add TELEGRAM_CHAT_ID    production preview development
openssl rand -hex 32 | npx vercel env add CRON_SECRET        production preview development
```

### Setup #3 — Deploy
```bash
git pull origin main --ff-only   # ดึง code ที่ laptop เตรียมไว้
npx vercel deploy --prod --yes
```

### Setup #4 — Test ทันที
```bash
SECRET=$(grep CRON_SECRET .env.local | cut -d= -f2- | tr -d '"')
curl -H "Authorization: Bearer $SECRET" \
  https://monitor-solar-inverter-deye-battery.vercel.app/api/cron/solar-threshold
```

ถ้า solar ตอนนี้ > 4.0 kW → Telegram จะส่งข้อความ `Solar > 4.0 kW` 📲
ถ้าน้อยกว่า → Telegram จะส่งข้อความ `Solar < 4.0 kW` เช่นกัน

ถ้าต้องการเทสฝั่ง `over` ตอนแดดน้อย ให้ลด threshold ชั่วคราว:
```bash
echo "0.1" | npx vercel env add SOLAR_ALERT_THRESHOLD_KW production --force
npx vercel deploy --prod --yes
# ทดสอบเสร็จเปลี่ยนกลับ 4.0
```

**รายละเอียดเต็ม + troubleshooting:** [docs/SOLAR_ALERTS.md](SOLAR_ALERTS.md)

---

---

## §0.1 Path C ลงเรียบร้อยแล้ว (2026-05-09 10:19 prod)

✅ **Path C live ใน production** — commit `d06b245` (Mac mini) ลบ Lens 1/2 toggle + ใส่ caption "Lens A · close-up" + เปลี่ยน label เป็น "Pan / Tilt · Lens B" + helper text — push แล้วผ่าน auto-deploy `c658326`

| สถานะปัจจุบัน | |
|---|---|
| Stream | Lens A (close-up basket, fixed) |
| PTZ buttons | ขยับ Lens B (เห็นได้ใน Tapo app) |
| UX | honest แล้ว — user รู้ว่า PTZ ขยับลูกตาที่มองไม่เห็นในหน้านี้ |

**ตัดสินใจที่ค้าง (optional, ไม่เร่ง):**
- **Path A** — pytapo bridge Lens B ผ่าน KLAP (cool-down 14h+ ผ่านแล้ว → retry ได้) ถ้า work จะได้สอง stream + เห็นภาพ Lens B ใน dashboard เลย
- **Path D** — ติดกล้องตัวที่สอง (Tapo C200/C210 fixed outdoor ~700-1200฿)

**Cleanup ค้าง:**
- Branch `path-c/single-lens-with-relabel` (commit `108ceb3`) บน Mac mini → dead branch ลบทิ้งได้ (`git branch -D path-c/single-lens-with-relabel` ที่ Mac mini)

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

### ส่วน 4 — Lens toggle removed (Path C executed direct on main)

| ขั้นตอน | สถานะ |
|---|---|
| Drop Lens 1/Lens 2 toggle (commit `d06b245`) | ✅ |
| Add caption "Lens A · close-up" | ✅ |
| Rename PTZ panel → "Pan / Tilt · Lens B" + helper "ขยับเลนส์ wide · ดู feed ใน Tapo app" | ✅ |
| Branch `path-c/single-lens-with-relabel` (108ceb3) | 🗑️ dead — Mac mini commit ตรง main ใช้แทน |

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

### §3.3 Path C — single lens + relabel PTZ ✅ DONE (live in prod)

**Status:** ✅ Mac mini commit `d06b245` ตรงเข้า main + auto-deploy `c658326` (May 9 10:19 prod)

Branch `path-c/single-lens-with-relabel` (108ceb3) ไม่ได้ใช้ — dead branch ลบได้

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
- [ ] Auto-recover cron (ทุก 5 นาที health check fail → trigger `cctv-restart.sh`)
- [ ] Uptime monitor (UptimeRobot ping Funnel URL → LINE Notify)
- [ ] Webhook จาก Vercel ถ้า prod เห็น stream offline → trigger restart อัตโนมัติ

## §5.1 One-click restart ✅

มีแล้ว — `scripts/cctv-restart.sh` + `scripts/cctv-restart.command` + `Restart Tapo CCTV.app` ใน /Applications
Setup Apple Shortcut / Automator app: ดู [docs/CCTV_RESTART.md](CCTV_RESTART.md)

## §5.2 Stability tuning (in progress)

User report ภาพหายหลายนาที — แผนแก้ + diagnostic script + tuning steps อยู่ใน [docs/CCTV_STABILITY.md](CCTV_STABILITY.md)

- `scripts/cctv-diagnose.sh` — รวบ logs จาก go2rtc + watchdog + sleep events + ping → markdown output
- §1: เร่ง watchdog 5min → 60s (low risk, ใหญ่สุด)
- §2: ลอง stream2 SD แทน stream1 HD (ถ้า §1 ไม่พอ)
- §3: tuning hls/segment_duration + hls.js liveBackBufferLength
- §4: WebRTC mode (ของใหญ่ ทำ last)

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

- Branch `main` HEAD: `c658326` (HLS watchdog) — production aliased to this
- Path C shipped via `d06b245` (direct commit on main, May 9 09:57)
- Branch `path-c/single-lens-with-relabel` (108ceb3) on Mac mini: 🗑️ dead, can delete
- Push pattern: `git push origin main`
