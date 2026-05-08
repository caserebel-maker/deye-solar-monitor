#!/usr/bin/env bash
# CCTV pipeline health check — รันบน Mac mini บ้าน
# ใช้: bash scripts/cctv-health.sh
#
# เช็ค 4 ชั้น:
#   1. กล้อง Tapo บน LAN (port 554)
#   2. go2rtc local (port 1984)
#   3. tailscaled + funnel
#   4. external HTTPS endpoint + segment download

set -u

CAMERA_IP="${CAMERA_IP:-192.168.1.159}"
GO2RTC_PORT="${GO2RTC_PORT:-1984}"
FUNNEL_HOST="${FUNNEL_HOST:-home-macmini.tail1d5579.ts.net}"
TS_BIN="/opt/homebrew/opt/tailscale/bin/tailscale"
TS_SOCK="/Users/${USER}/.tailscale/tailscaled.sock"

PASS="✓"
FAIL="✗"
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
ok()    { echo "  $(green "$PASS") $1"; }
bad()   { echo "  $(red "$FAIL") $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }

FAIL_COUNT=0

echo "═══ CCTV pipeline health check ═══"
echo

# 1. Camera RTSP port
echo "[1/4] Tapo camera ($CAMERA_IP:554)"
if nc -zv -G 2 "$CAMERA_IP" 554 >/dev/null 2>&1; then
  ok "RTSP port 554 reachable"
else
  bad "RTSP port 554 unreachable — check WiFi / camera power / IP"
fi
echo

# 2. go2rtc
echo "[2/4] go2rtc (localhost:$GO2RTC_PORT)"
if launchctl list 2>/dev/null | grep -q com.go2rtc; then
  ok "LaunchAgent loaded"
else
  bad "LaunchAgent not loaded — run: launchctl load ~/Library/LaunchAgents/com.go2rtc.plist"
fi
if STREAMS=$(curl -s -m 3 "http://localhost:$GO2RTC_PORT/api/streams" 2>/dev/null) && echo "$STREAMS" | grep -q '"tapo"'; then
  ok "API responds + 'tapo' stream registered"
else
  bad "API not responding or 'tapo' missing — tail /tmp/go2rtc.log"
fi
echo

# 3. Tailscale + funnel
echo "[3/4] Tailscale ($FUNNEL_HOST)"
if launchctl list 2>/dev/null | grep -q com.tailscale.tailscaled; then
  ok "tailscaled LaunchAgent loaded"
else
  bad "tailscaled not loaded — run: launchctl load ~/Library/LaunchAgents/com.tailscale.tailscaled.plist"
fi
if STATUS=$("$TS_BIN" --socket="$TS_SOCK" status 2>/dev/null) && echo "$STATUS" | grep -qE "^100\."; then
  ok "logged in to tailnet ($(echo "$STATUS" | head -1 | awk '{print $2}'))"
else
  bad "not logged in — run: $TS_BIN --socket=$TS_SOCK up --hostname=home-macmini"
fi
if "$TS_BIN" --socket="$TS_SOCK" serve status 2>/dev/null | grep -q "Funnel on"; then
  ok "Funnel active"
else
  bad "Funnel off — run: $TS_BIN --socket=$TS_SOCK funnel --bg --https=443 http://localhost:$GO2RTC_PORT"
fi
echo

# 4. External HTTPS pipeline
echo "[4/4] External HTTPS endpoint"
M3U8="https://$FUNNEL_HOST/api/stream.m3u8?src=tapo"
if HEAD=$(curl -sI -m 10 "$M3U8" 2>/dev/null) && echo "$HEAD" | head -1 | grep -q "200"; then
  ok "master m3u8 returns 200 OK"
else
  bad "master m3u8 unreachable — DNS or Funnel issue"
fi
# segment download (real video bytes)
ID=$(curl -s -m 5 "$M3U8" 2>/dev/null | grep -oE 'id=[A-Za-z0-9]+' | head -1 | sed 's/id=//')
if [ -n "$ID" ]; then
  SEG_URL="https://$FUNNEL_HOST/api/hls/segment.ts?id=$ID&n=0"
  SIZE=$(curl -s -m 10 "$SEG_URL" -o /dev/null -w '%{size_download}' 2>/dev/null)
  if [ "${SIZE:-0}" -gt 10000 ]; then
    ok "video segment downloaded (${SIZE} bytes)"
  else
    bad "segment download failed (size=$SIZE) — go2rtc may have lost RTSP"
  fi
else
  bad "could not extract session id from master playlist"
fi
echo

# Summary
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "$(green '═══ ALL GREEN — pipeline healthy ═══')"
  echo "  Dashboard: https://monitor-solar-inverter-deye-battery.vercel.app/"
  exit 0
else
  echo "$(red "═══ $FAIL_COUNT check(s) failed — see suggestions above ═══")"
  exit 1
fi
