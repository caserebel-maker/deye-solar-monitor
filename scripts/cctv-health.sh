#!/usr/bin/env bash
# CCTV pipeline health check — รันบน Mac mini บ้าน
# ใช้: bash scripts/cctv-health.sh
#
# เช็ค 5 ชั้น:
#   1. กล้อง Tapo บน LAN (port 554)
#   2. go2rtc local (port 1984)
#   3. tailscaled + funnel
#   4. PTZ proxy local (port 1985, Python FastAPI)
#   5. external HTTPS endpoints (HLS + PTZ via Funnel)

set -u

CAMERA_IP="${CAMERA_IP:-192.168.1.159}"
GO2RTC_PORT="${GO2RTC_PORT:-1984}"
PTZ_PORT="${PTZ_PORT:-1985}"
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
echo "[1/5] Tapo camera ($CAMERA_IP:554)"
if nc -zv -G 2 "$CAMERA_IP" 554 >/dev/null 2>&1; then
  ok "RTSP port 554 reachable"
else
  bad "RTSP port 554 unreachable — check WiFi / camera power / IP"
fi
echo

# 2. go2rtc
echo "[2/5] go2rtc (localhost:$GO2RTC_PORT)"
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
echo "[3/5] Tailscale ($FUNNEL_HOST)"
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

# 4. PTZ proxy (Python FastAPI on :1985)
echo "[4/5] PTZ proxy (localhost:$PTZ_PORT)"
if curl -s -m 3 "http://localhost:$PTZ_PORT/healthz" 2>/dev/null | grep -q '"ok":true'; then
  ok "PTZ proxy responding + camera connected"
else
  bad "PTZ proxy down — restart from terminal:"
  echo "       cd ~/cctv-control && set -a; source .env; set +a && nohup uv run uvicorn server:app --host 127.0.0.1 --port $PTZ_PORT >/tmp/cctv-ptz.log 2>&1 & disown"
fi
echo

# 5. External HTTPS pipeline
# Mac mini's own DNS resolver intercepts *.ts.net (it's a tailnet member),
# so resolve through public DNS first and curl with --resolve.
echo "[5/5] External HTTPS endpoint"
PUB_IP=$(dig +short A "$FUNNEL_HOST" @8.8.8.8 2>/dev/null | head -1)
if [ -z "$PUB_IP" ]; then
  bad "public DNS for $FUNNEL_HOST unresolved — Funnel DNS not propagated"
  echo
  # Skip remaining external checks
else
  RESOLVE="--resolve $FUNNEL_HOST:443:$PUB_IP"
  M3U8="https://$FUNNEL_HOST/api/stream.m3u8?src=tapo"
  if HEAD=$(curl -sI -m 10 $RESOLVE "$M3U8" 2>/dev/null) && echo "$HEAD" | head -1 | grep -q "200"; then
    ok "master m3u8 returns 200 OK (via $PUB_IP)"
  else
    bad "master m3u8 unreachable — Funnel issue"
  fi
  # segment download (real video bytes)
  ID=$(curl -s -m 5 $RESOLVE "$M3U8" 2>/dev/null | grep -oE 'id=[A-Za-z0-9]+' | head -1 | sed 's/id=//')
  if [ -n "$ID" ]; then
    SEG_URL="https://$FUNNEL_HOST/api/hls/segment.ts?id=$ID&n=0"
    SIZE=$(curl -s -m 10 $RESOLVE "$SEG_URL" -o /dev/null -w '%{size_download}' 2>/dev/null)
    if [ "${SIZE:-0}" -gt 10000 ]; then
      ok "video segment downloaded (${SIZE} bytes)"
    else
      bad "segment download failed (size=$SIZE) — go2rtc may have lost RTSP"
    fi
  else
    bad "could not extract session id from master playlist"
  fi
  # PTZ proxy via Funnel
  PTZ_HEALTH=$(curl -s -m 5 $RESOLVE "https://$FUNNEL_HOST/control/healthz" 2>/dev/null)
  if echo "$PTZ_HEALTH" | grep -q '"ok":true'; then
    ok "PTZ proxy reachable through Funnel"
  else
    bad "PTZ proxy not reachable through Funnel — check Tailscale serve mount /control"
  fi
  echo
fi

# Summary
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "$(green '═══ ALL GREEN — pipeline healthy ═══')"
  echo "  Dashboard: https://monitor-solar-inverter-deye-battery.vercel.app/"
  exit 0
else
  echo "$(red "═══ $FAIL_COUNT check(s) failed — see suggestions above ═══")"
  exit 1
fi
