# NEXT — Deye Solar Monitor

> Living handoff doc. Overwrite each session with current state.

---

## §0 TL;DR

✅ **Tapo CCTV pipeline เสร็จสมบูรณ์ + ขึ้น production แล้ว**

- Live URL: https://monitor-solar-inverter-deye-battery.vercel.app/
- HLS endpoint: https://home-macmini.tail1d5579.ts.net/api/stream.m3u8?src=tapo
- การ์ด **Tapo CCTV Monitor** ในหน้า dashboard ดึง stream จาก Mac mini บ้านผ่าน Tailscale Funnel

ครั้งหน้าเปิด Claude Code: ตรวจสุขภาพ pipeline ที่ §3 ก่อน (ถ้าการ์ดขึ้น offline)

---

## §1 ที่ทำไปแล้ว session นี้ (Mac mini บ้าน, 2026-05-08)

| ขั้นตอน | สถานะ |
|---|---|
| Clone repo → `/Volumes/C1TB/EB-CI/deye-solar-monitor` | ✅ |
| ตั้ง git `user.email = caserebel@gmail.com` (Vercel team rule) | ✅ |
| Tapo Camera Account (ทำใน Tapo app) — username `Pondsol@r1` | ✅ |
| Verify RTSP `rtsp://...@192.168.1.159:554/stream1` ใช้ได้ | ✅ |
| Download `go2rtc v1.9.14` darwin_arm64 → `/opt/homebrew/bin/go2rtc` | ✅ |
| Config `~/.config/go2rtc/go2rtc.yaml` (mode 600 — มี cred) | ✅ |
| LaunchAgent `~/Library/LaunchAgents/com.go2rtc.plist` (auto-start at boot) | ✅ |
| `brew install tailscale` (formula CLI-only, **ไม่ต้อง sudo**) | ✅ |
| LaunchAgent `~/Library/LaunchAgents/com.tailscale.tailscaled.plist` (userspace mode + custom socket/state) | ✅ |
| Tailscale login (caserebel@gmail.com tailnet) hostname `home-macmini` | ✅ |
| Approve Funnel feature ใน tailnet | ✅ |
| `tailscale funnel --bg --https=443 http://localhost:1984` (auto-cert via Let's Encrypt) | ✅ |
| Add `NEXT_PUBLIC_CCTV_HLS_URL` ใน Vercel (Production + Development) | ✅ |
| `vercel deploy --prod` — fresh build with env baked | ✅ |
| Verify URL bake-in client bundle (`grep "home-macmini.*tapo" chunks`) | ✅ |

**Quirks สำคัญที่เจอ:**

1. `brew install go2rtc` ❌ formula ไม่มีแล้ว → ใช้ binary จาก GitHub release
2. `brew install --cask tailscale-app` ❌ ต้อง sudo + kernel ext → ใช้ formula `tailscale` แทน (CLI-only, userspace networking)
3. `tailscaled` default ต้อง root → flag `--tun=userspace-networking` + `--socket=/Users/.../tailscaled.sock` ทำให้รันเป็น user ได้
4. Tailscale Funnel ต้อง enable feature ก่อน → URL approve อยู่ใน error message ของ `tailscale funnel`
5. DNS ของ `*.tail1d5579.ts.net` propagate ระหว่าง DNSimple NS ไม่ sync (ns1 ช้า, ns3 เร็ว) — รอ ~5–10 นาที
6. Vercel CLI v51 `vercel env add NAME preview` ต้อง interactive — `*` argument ใช้ไม่ได้ → preview env ยังไม่ได้ตั้ง (ไม่กระทบ live site)

---

## §2 Architecture ปัจจุบัน

```
Tapo C-series (192.168.1.159, RTSP)
  └─ rtsp://Pondsol%40r1:***@192.168.1.159:554/stream1
       │
       ▼  (LAN)
Mac mini บ้าน (PondM2pros-Mac-mini, 192.168.1.136)
  • go2rtc :1984 (LaunchAgent com.go2rtc, KeepAlive)
  • tailscaled userspace + socket=/Users/pondm1/.tailscale/tailscaled.sock
  • tailscale funnel --https=443 → http://localhost:1984
       │
       ▼  (Tailscale Funnel — public HTTPS via Let's Encrypt)
https://home-macmini.tail1d5579.ts.net
  └─ /api/stream.m3u8?src=tapo
       │
       ▼  (Vercel build — NEXT_PUBLIC baked at build time)
https://monitor-solar-inverter-deye-battery.vercel.app
  └─ <CctvCard> → <CctvLivePlayer> hls.js → <video>
```

**Stream specs (verified from m3u8 head):**
- BANDWIDTH: 192000
- CODECS: avc1.640029 (H.264 High Profile L4.1)
- DERP relay: Singapore (~39ms RTT)

---

## §3 Health checks (ครั้งหน้ามาเช็ค pipeline)

ถ้าการ์ด CCTV ขึ้น "Awaiting Tapo stream" หรือ "Stream offline" — รัน script เดียวจบ:

```bash
bash scripts/cctv-health.sh
```

Script จะเช็ค 4 ชั้น (camera RTSP, go2rtc, tailscale+funnel, external HTTPS+segment download) + บอกคำสั่งแก้ถ้า fail

### Manual checks (ถ้าต้อง dig deeper)

```bash
# 1. go2rtc รันอยู่?
launchctl list | grep go2rtc
curl -s http://localhost:1984/api/streams | head

# 2. tailscaled + funnel ออน?
launchctl list | grep tailscaled
/opt/homebrew/opt/tailscale/bin/tailscale --socket=/Users/pondm1/.tailscale/tailscaled.sock status
/opt/homebrew/opt/tailscale/bin/tailscale --socket=/Users/pondm1/.tailscale/tailscaled.sock serve status

# 3. กล้อง LAN reachable?
nc -zv 192.168.1.159 554

# 4. external HTTPS endpoint?
curl -sI "https://home-macmini.tail1d5579.ts.net/api/stream.m3u8?src=tapo"
```

### Restart commands

```bash
# Restart go2rtc
launchctl kickstart -k gui/$UID/com.go2rtc

# Restart tailscaled
launchctl kickstart -k gui/$UID/com.tailscale.tailscaled

# Re-enable funnel ถ้า serve config หาย
/opt/homebrew/opt/tailscale/bin/tailscale --socket=/Users/pondm1/.tailscale/tailscaled.sock funnel --bg --https=443 http://localhost:1984
```

---

## §4 Future enhancements (ไม่เร่ง)

- [ ] เพิ่ม **basic auth** ใน go2rtc config (`auth: "viewer:..."`) — กัน public ดู stream
- [ ] WebRTC mode ใน go2rtc (latency <1s แทน HLS 5–10s)
- [ ] Add second camera — เพิ่ม `tapo2:` ใน go2rtc.yaml + การ์ดที่ 2 ในหน้า dashboard
- [ ] Tailscale ACL: lock funnel ให้แค่ `home-macmini` host (ไม่ใช่ทั้ง user)

---

## §5 Env vars + endpoints (stable reference)

**Vercel project:** `monitor-solar-inverter-deye-battery-web` (id `prj_4Iua8s4gmeaGU7AplwkWixTvvIll`)
**Vercel team:** `suriyas-projects-d1b3e6b3` (caserebel@gmail.com — git author rule)

| Env | Prod | Dev | Preview |
|---|---|---|---|
| `DEYE_*` | ✅ | — | — |
| `WEATHER_LAT/LON` | (default ใน code) | — | — |
| `NEXT_PUBLIC_CCTV_HLS_URL` | ✅ | ✅ | ✅ |

**Network (บ้าน):**
- Camera IP: `192.168.1.159` (Tapo, Static)
- Mac mini IP: `192.168.1.136` (PondM2pros-Mac-mini)
- Gateway: `192.168.1.1`
- Tailscale node: `home-macmini` (100.97.45.25, fd7a:115c:a1e0::633b:2d19)
- Tailnet: `tail1d5579.ts.net`

**Local files (มี cred — ห้าม commit):**
- `~/.config/go2rtc/go2rtc.yaml` (mode 600, RTSP creds)
- `~/.tailscale/tailscaled.sock` + state files
- `home-macmini.tail1d5579.ts.net.{crt,key}` (Let's Encrypt cert จาก `tailscale cert`)

---

## §6 Git state

- Last commit ก่อน session นี้: `99af4e8` — docs(handoff): add NEXT.md
- Branch: `main` (no worktree branches)
- Push pattern: `git push origin main` (direct push)
