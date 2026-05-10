# CCTV Stability Tuning

แก้ปัญหา "ภาพหายบ่อย" สำหรับ Tapo C545D + go2rtc + Tailscale Funnel pipeline

## เริ่มจากการวินิจฉัย

```bash
bash scripts/cctv-diagnose.sh | pbcopy   # คัดลอกแล้ว paste ให้ Claude วิเคราะห์
# หรือ
bash scripts/cctv-diagnose.sh > /tmp/cctv-diag.md
open /tmp/cctv-diag.md
```

Output รวบ:
1. Health snapshot 5/5
2. RTSP drop count + last 30 lines จาก go2rtc log
3. Watchdog trigger/recovery count
4. Mac mini sleep/wake events 24 ชม.ล่าสุด
5. Ping packet loss ไปกล้อง
6. go2rtc API stream stats
7. Watchdog LaunchAgent interval
8. Auto-recommended actions

---

## §1 — เร่ง watchdog 5 นาที → 60 วินาที (ทำเลย)

watchdog ปัจจุบัน probe ทุก 5 นาที = stream อาจค้างได้สูงสุด ~5 นาทีก่อน auto-recover ลด interval ลง 5 เท่า:

### ⚠️ macOS Tahoe — scripts ต้องอยู่ใน home dir ไม่ใช่ /Volumes

LaunchAgent ที่ launchd รัน **ถูก block** จากการ access `/Volumes/*` (external drive) — error คือ
`Operation not permitted` แม้ user ไม่เห็นใน UI privacy เลย Terminal มี Full Disk Access แต่
launchd ไม่มี → script ไม่เคยรัน

**แก้:** mirror scripts ไปที่ `~/cctv-scripts/` (home dir = ไม่ block):

```bash
mkdir -p ~/cctv-scripts
cp /Volumes/.../scripts/cctv-{watchdog,restart,health}.sh ~/cctv-scripts/
chmod +x ~/cctv-scripts/*.sh
```

แล้วชี้ plist ไปที่ `~/cctv-scripts/cctv-watchdog.sh` แทน path ใน /Volumes
(ดูข้างล่าง — vi/nano edit `ProgramArguments` ใน plist ก่อน reload)

### วิธีแก้ plist

```bash
PLIST=~/Library/LaunchAgents/com.ebci.cctv-watchdog.plist

# Backup ก่อน
cp "$PLIST" "$PLIST.bak"

# Set interval = 60s
plutil -replace StartInterval -integer 60 "$PLIST"

# Point ProgramArguments to home dir (avoid /Volumes block)
plutil -replace ProgramArguments -json '["/bin/bash","/Users/'"$USER"'/cctv-scripts/cctv-watchdog.sh"]' "$PLIST"

# Reload
launchctl bootout "gui/$UID/com.ebci.cctv-watchdog" 2>/dev/null
launchctl bootstrap "gui/$UID" "$PLIST"

# Verify
plutil -extract StartInterval raw "$PLIST"   # ควรขึ้น 60
plutil -extract ProgramArguments.1 raw "$PLIST"   # ควรขึ้น /Users/.../cctv-scripts/...
```

### วิธีตรวจว่า watchdog รันจริง

```bash
# touch state file
date > /tmp/cctv-watchdog.state

# รอ 65s — watchdog tick ครั้งหน้า
sleep 65

# state file ควรหาย (watchdog เห็น healthy + clear state)
ls -la /tmp/cctv-watchdog.state   # No such file = ✅
cat /tmp/cctv-watchdog.log         # มีบรรทัด "RECOVERED — pipeline healthy again"
```

ถ้า launchd err มี `Operation not permitted` → script ยังอยู่ใน /Volumes — ทำ mirror ตาม
section ข้างบนก่อน

### ผลกระทบ

- **Downtime สูงสุด: 5 นาที → 1 นาที**
- CPU/network: probe เป็น curl เบาๆ + dig — รันบ่อยขึ้น 5 เท่า ก็ไม่กิน resource
- watchdog state file (`/tmp/cctv-watchdog.state`) กัน restart loop อยู่แล้ว → ปลอดภัย

### Rollback

```bash
mv "$PLIST.bak" "$PLIST"
launchctl bootout "gui/$UID/com.ebci.cctv-watchdog"
launchctl bootstrap "gui/$UID" "$PLIST"
```

---

## §2 — Switch RTSP HD → SD (ถ้า drop ยังบ่อย หลังเร่ง watchdog)

Tapo C545D RTSP **stream1 (HD 1920×1080)** ดรอปบ่อยกว่า **stream2 (SD 640×360)** มาก เพราะ bandwidth สูงกว่าเกือบ 4 เท่า → packet loss ก็ rebuild ยากกว่า

### วิธีแก้ go2rtc.yaml

```bash
# Backup ก่อน
cp ~/.config/go2rtc/go2rtc.yaml ~/.config/go2rtc/go2rtc.yaml.bak

# แก้ไฟล์ — เปลี่ยน stream1 → stream2 ใน source ของ tapo:
nano ~/.config/go2rtc/go2rtc.yaml
```

**Before:**
```yaml
streams:
  tapo: rtsp://USER:PASS@192.168.1.159:554/stream1
```

**After:**
```yaml
streams:
  # SD (stream2) สำหรับ stability — bandwidth ~1/4 ของ HD นิ่งกว่ามาก
  tapo: rtsp://USER:PASS@192.168.1.159:554/stream2
```

### Reload go2rtc

```bash
launchctl kickstart -k gui/$UID/com.go2rtc
sleep 3
curl -s http://localhost:1984/api/streams | python3 -m json.tool
```

### Verify จาก laptop

```bash
PUB_IP=$(dig +short A home-macmini.tail1d5579.ts.net @8.8.8.8 | head -1)
curl -sI --resolve "home-macmini.tail1d5579.ts.net:443:$PUB_IP" \
  "https://home-macmini.tail1d5579.ts.net/api/stream.m3u8?src=tapo" | head -3
```

ต้อง `HTTP/2 200` — ถ้า OK เปิด dashboard ดูรอ 1-2 ชม. ถ้านิ่งขึ้นชัด = สาเหตุคือ HD bandwidth

### Trade-off

| | HD stream1 | SD stream2 |
|---|---|---|
| Resolution | 1920×1080 | 640×360 |
| Bandwidth | ~2-4 Mbps | ~0.5-1 Mbps |
| Stability | ดรอปบ่อย | นิ่งมาก |
| ใช้ดู basket close-up | ชัด | พออ่านป้ายได้ |
| ใช้ดู PTZ wide | n/a (Lens B ไม่มี RTSP) | n/a |

> **Tip:** ภาพ "Lens A · close-up" ใน dashboard ใช้ดู basket อยู่แล้ว — SD ก็พอเห็นว่ามีคน/ไม่มีคน ไม่ต้องอ่านลายนิ้วมือ

---

## §3 — Tuning เพิ่มเติม (ถ้ายังไม่นิ่ง)

### 3.1 ลด HLS segment duration ใน go2rtc
go2rtc default segment duration = 6s — ดรอปครั้งเดียว = หาย 6s ขั้นต่ำ
เพิ่มใน `go2rtc.yaml`:
```yaml
hls:
  segment_duration: 2s   # default 6s → 2s = recover เร็วขึ้น 3 เท่า
```

### 3.2 hls.js client config (อยู่ใน app/page.tsx แล้ว)
ปัจจุบัน:
- `liveSyncDurationCount: 2` (ตามท้าย live edge)
- `fragLoadingMaxRetry: 6`
- silent-stall watchdog 6s
- POST `/api/restart` ไป go2rtc ตอน stall ครั้งที่ 2

ปรับเพิ่มได้:
- เพิ่ม `liveBackBufferLength: 30` ให้ buffer ภาพย้อนหลัง 30s — drop เล็กๆ ไม่กระทบ
- ลด stall watchdog 6s → 4s ถ้าอยาก aggressive ขึ้น

### 3.3 Wired Ethernet สำหรับ Mac mini
ถ้า Mac mini ต่อ WiFi → ดึง LAN cable มาต่อ ลด network jitter ทันที

### 3.4 เปลี่ยนกล้อง (last resort)
ถ้า Tapo C545D firmware ไม่ stable แม้ทำ §1+§2 → กล้องที่ RTSP เสถียรกว่า:
- Reolink E1 Pro (~1500฿) — RTSP มาตรฐาน, stable
- Tapo C320WS outdoor (~1800฿) — single lens, RTSP เสถียรกว่า C545D
- Hikvision/Dahua DIY (~2500-4000฿) — server-grade RTSP

---

## §4 — Pipeline ใหญ่: WebRTC แทน HLS (ของใหญ่ ทำ last)

go2rtc รองรับ WebRTC ซึ่งเหนือกว่า HLS:
- Latency <1s (vs HLS 5-10s)
- Resilient to packet loss (HLS รื้อ segment ใหม่ทุกครั้ง)
- Lower bandwidth ที่ end-user

**แต่:** setup ซับซ้อนขึ้น
- Tailscale Funnel ต้องเปิด UDP port หรือใช้ TURN relay
- Browser side ใช้ WebRTC API (ไม่ใช่ hls.js)
- Mobile Safari มี quirks

**แนะนำทำเมื่อ:** §1+§2+§3 ทุกอย่างทำหมดแล้วยังไม่นิ่ง

---

## §5 — Auto-diagnose loop (optional advanced)

ถ้าอยากให้ system **บันทึก downtime stats** ทุกวัน:

```bash
# ใส่ใน crontab Mac mini ทุก 6 ชม.
0 */6 * * * /Volumes/.../deye-solar-monitor/scripts/cctv-diagnose.sh > /tmp/cctv-diag-$(date +\%F-\%H).md
```

แล้ว weekly review = เห็น trend "วันไหน drop เยอะ"

---

## ลำดับที่แนะนำสำหรับเครื่องไหน

**Mac mini ทำตามนี้:**
1. รัน diagnose ดูสภาพปัจจุบัน → `bash scripts/cctv-diagnose.sh | pbcopy` → paste มาให้ดู
2. แก้ §1 (watchdog 60s) — ลอง 1-2 วัน
3. ยังหาย → แก้ §2 (SD stream) — ลอง 1-2 วัน
4. ยังหาย → §3 tuning เพิ่ม
5. ยังหาย → §4 WebRTC หรือ §3.4 เปลี่ยนกล้อง
