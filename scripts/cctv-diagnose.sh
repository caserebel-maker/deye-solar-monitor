#!/usr/bin/env bash
# CCTV diagnostics — รวบ log สำคัญจากทุกชั้น output เป็น markdown
# ใช้: bash scripts/cctv-diagnose.sh
# Tip: bash scripts/cctv-diagnose.sh | pbcopy   (copy เลย, paste ให้ Claude ดู)

set -u

CAMERA_IP="${CAMERA_IP:-192.168.1.159}"
WINDOW_HRS="${WINDOW_HRS:-24}"

since=$(TZ=Asia/Bangkok date -v-${WINDOW_HRS}H "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "-${WINDOW_HRS} hours" "+%Y-%m-%d %H:%M:%S")

echo "# CCTV diagnostic ($(TZ=Asia/Bangkok date "+%F %H:%M:%S %Z"))"
echo
echo "Window: last ${WINDOW_HRS}h since \`${since}\`"
echo

#─────────────────────────────────────────────
echo "## 1. Quick health snapshot"
echo
echo '```'
if command -v bash >/dev/null && [ -x "$(dirname "$0")/cctv-health.sh" ]; then
  bash "$(dirname "$0")/cctv-health.sh" 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g'
else
  echo "(cctv-health.sh missing)"
fi
echo '```'
echo

#─────────────────────────────────────────────
echo "## 2. RTSP drops in go2rtc log"
echo
DROPS=0
RECONNECTS=0
if [ -f /tmp/go2rtc.log ]; then
  DROPS=$(grep -ciE "rtsp.*(disconnect|EOF|broken|reset|timeout|i/o error)" /tmp/go2rtc.log 2>/dev/null || echo 0)
  RECONNECTS=$(grep -ciE "rtsp.*(connect|dial)" /tmp/go2rtc.log 2>/dev/null || echo 0)
  echo "- Disconnect/error events (lifetime of log): **${DROPS}**"
  echo "- Connect/reconnect events (lifetime of log): **${RECONNECTS}**"
  echo
  echo "### Last 30 RTSP-related lines"
  echo '```'
  grep -iE "rtsp|disconnect|reconnect|EOF|error|stream" /tmp/go2rtc.log 2>/dev/null | tail -30
  echo '```'
else
  echo "_/tmp/go2rtc.log ไม่มี — go2rtc อาจยังไม่ได้รัน หรือ LaunchAgent log path ต่างกัน_"
fi
echo

#─────────────────────────────────────────────
echo "## 3. Watchdog log (last 50 lines)"
echo
if [ -f /tmp/cctv-watchdog.log ]; then
  TRIGGERS=$(grep -c "running cctv-restart.sh" /tmp/cctv-watchdog.log 2>/dev/null || echo 0)
  RECOVERS=$(grep -c "RECOVERED" /tmp/cctv-watchdog.log 2>/dev/null || echo 0)
  echo "- Auto-restart triggered (lifetime): **${TRIGGERS}**"
  echo "- Recovery events (lifetime): **${RECOVERS}**"
  echo
  echo '```'
  tail -50 /tmp/cctv-watchdog.log
  echo '```'
else
  echo "_/tmp/cctv-watchdog.log ไม่มี — watchdog LaunchAgent ยังไม่ได้รัน?_"
fi
echo

#─────────────────────────────────────────────
echo "## 4. Mac mini sleep/wake events (last ${WINDOW_HRS}h)"
echo
echo '```'
pmset -g log 2>/dev/null \
  | awk -v since="$since" '$0 >= since' \
  | grep -iE "Sleep|Wake.*due to|DarkWake" \
  | tail -30
echo '```'
echo

#─────────────────────────────────────────────
echo "## 5. Network — packet loss Mac mini ↔ camera"
echo
echo '```'
ping -c 50 -i 0.2 -W 1000 "$CAMERA_IP" 2>&1 | tail -3
echo '```'
echo

#─────────────────────────────────────────────
echo "## 6. go2rtc API — current stream stats"
echo
if curl -s -m 3 http://localhost:1984/api/streams >/dev/null 2>&1; then
  echo '```json'
  curl -s -m 3 http://localhost:1984/api/streams 2>/dev/null \
    | python3 -m json.tool 2>/dev/null \
    | head -60
  echo '```'
else
  echo "_go2rtc API :1984 ไม่ตอบ_"
fi
echo

#─────────────────────────────────────────────
echo "## 7. Watchdog LaunchAgent interval"
echo
PLIST="$HOME/Library/LaunchAgents/com.ebci.cctv-watchdog.plist"
if [ -f "$PLIST" ]; then
  INTERVAL=$(plutil -extract StartInterval raw "$PLIST" 2>/dev/null || echo "unknown")
  echo "- Plist: \`$PLIST\`"
  echo "- StartInterval: **${INTERVAL} seconds** ($((${INTERVAL:-0} / 60)) min)"
  if [ "${INTERVAL:-0}" -ge 300 ] 2>/dev/null; then
    echo "- ⚠️ แนะนำลด → 60 (ดู docs/CCTV_STABILITY.md)"
  fi
else
  echo "_LaunchAgent plist ไม่เจอ — watchdog อาจไม่ได้ install_"
fi
echo

#─────────────────────────────────────────────
echo "## 8. Suggested next actions"
echo
if [ "${DROPS:-0}" -gt 20 ]; then
  echo "- 🔴 RTSP drops > 20 ครั้ง — แนะนำ **switch ไป stream2 (SD)** ดู \`docs/CCTV_STABILITY.md\` §2"
fi
if [ -n "${INTERVAL:-}" ] && [ "$INTERVAL" -ge 300 ] 2>/dev/null; then
  echo "- 🟠 Watchdog interval ${INTERVAL}s — แนะนำลด **60s** ดู \`docs/CCTV_STABILITY.md\` §1"
fi
echo "- 📋 paste output นี้ให้ Claude ใน chat ถัดไปเพื่อ analyze"
