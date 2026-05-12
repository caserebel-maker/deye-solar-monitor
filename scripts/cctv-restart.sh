#!/usr/bin/env bash
# One-click CCTV pipeline restart — รันบน Mac mini บ้าน
# ใช้: bash scripts/cctv-restart.sh   (หรือ double-click cctv-restart.command)
#
# ทำตามลำดับ:
#   1. Kickstart com.go2rtc LaunchAgent
#   2. Kickstart com.tailscale.tailscaled LaunchAgent
#   3. Tailscale up + Funnel
#   4. Kickstart com.cctv.ptz LaunchAgent (PTZ proxy)
#   5. รอ services พร้อม → run health check
#   6. macOS notification

set -u

GO2RTC_LABEL="${GO2RTC_LABEL:-com.go2rtc}"
TS_LABEL="${TS_LABEL:-com.tailscale.tailscaled}"
PTZ_LABEL="${PTZ_LABEL:-com.ebci.cctv-ptz}"

GO2RTC_PORT="${GO2RTC_PORT:-1984}"
PTZ_PORT="${PTZ_PORT:-1985}"

TS_BIN="/opt/homebrew/opt/tailscale/bin/tailscale"
TS_SOCK="/Users/${USER}/.tailscale/tailscaled.sock"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cyan()  { printf '\033[36m%s\033[0m' "$1"; }
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

step() { echo; echo "$(cyan "▶ $1")"; }
ok()   { echo "  $(green "✓") $1"; }
warn() { echo "  $(red "✗") $1"; }

notify() {
  local title="$1" msg="$2" sound="${3:-Glass}"
  osascript -e "display notification \"$msg\" with title \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

kick() {
  local label="$1"
  if launchctl print "gui/$UID/$label" >/dev/null 2>&1; then
    launchctl kickstart -k "gui/$UID/$label" 2>/dev/null && ok "$label kickstarted"
  else
    # Not loaded — try to bootstrap from ~/Library/LaunchAgents
    local plist="$HOME/Library/LaunchAgents/$label.plist"
    if [ -f "$plist" ]; then
      launchctl bootstrap "gui/$UID" "$plist" 2>/dev/null && ok "$label bootstrapped"
    else
      warn "$label LaunchAgent not found at $plist"
      return 1
    fi
  fi
}

echo "═══ CCTV pipeline restart ═══"
notify "🔄 CCTV" "Restarting pipeline..." "Pop"

step "[1/5] go2rtc"
kick "$GO2RTC_LABEL" || true

step "[2/5] tailscaled"
kick "$TS_LABEL" || true
sleep 3   # ให้ tailscaled socket พร้อม

step "[3/5] Tailscale down→up + Funnel (forces ingress edge re-sync)"
# After a Mac mini reboot the Tailscale Funnel control plane may
# assign a fresh ingress edge IP that doesn't yet have a route back
# to this node — TLS succeeds but requests hang. A quick down→up
# re-registers the node and the edge catches up within ~10s.
if [ -x "$TS_BIN" ] && [ -S "$TS_SOCK" ]; then
  "$TS_BIN" --socket="$TS_SOCK" down >/dev/null 2>&1
  sleep 2
  "$TS_BIN" --socket="$TS_SOCK" up --hostname=home-macmini >/dev/null 2>&1 && ok "tailnet up"
  sleep 3   # give the control plane a moment to publish the new mapping
  "$TS_BIN" --socket="$TS_SOCK" funnel --bg --https=443 "http://localhost:$GO2RTC_PORT" >/dev/null 2>&1 && ok "funnel active on :443 → :$GO2RTC_PORT"
  "$TS_BIN" --socket="$TS_SOCK" funnel --bg --https=443 --set-path=/control "http://127.0.0.1:$PTZ_PORT" >/dev/null 2>&1 && ok "funnel mount /control → :$PTZ_PORT"
else
  warn "tailscale binary or socket missing"
fi

step "[4/5] PTZ proxy"
if launchctl print "gui/$UID/$PTZ_LABEL" >/dev/null 2>&1 || [ -f "$HOME/Library/LaunchAgents/$PTZ_LABEL.plist" ]; then
  kick "$PTZ_LABEL" || true
else
  # Fallback: spawn manually if LaunchAgent ไม่มี
  warn "$PTZ_LABEL LaunchAgent ไม่มี — spawn manual"
  if [ -d "$HOME/cctv-control" ]; then
    (
      cd "$HOME/cctv-control"
      set -a; [ -f .env ] && source .env; set +a
      pkill -f "uvicorn server:app.*$PTZ_PORT" 2>/dev/null || true
      nohup uv run uvicorn server:app --host 127.0.0.1 --port "$PTZ_PORT" \
        >/tmp/cctv-ptz.log 2>&1 & disown
    )
    ok "PTZ proxy spawned manually (PID ใน /tmp/cctv-ptz.log)"
  else
    warn "$HOME/cctv-control ไม่มี — skip PTZ"
  fi
fi

step "[5/5] รอ services warm-up + Funnel edge resync (poll up to 90s)"
# Local daemons come up in ~3s, but the Funnel ingress edge can take
# 10–60s to publish a fresh routing entry for this node after the
# down→up bounce above. Poll the *external* endpoint so we don't return
# success until traffic actually flows end-to-end — otherwise watchdog
# sets its state file and refuses to retry.
FUNNEL_HOST="${FUNNEL_HOST:-home-macmini.tail1d5579.ts.net}"
HEALTHY=0
for i in $(seq 1 18); do
  PUB_IP=$(dig +short +time=3 A "$FUNNEL_HOST" @8.8.8.8 2>/dev/null | head -1)
  if [ -n "$PUB_IP" ]; then
    HTTP=$(curl -s -m 5 --resolve "$FUNNEL_HOST:443:$PUB_IP" \
      -o /dev/null -w '%{http_code}' \
      "https://$FUNNEL_HOST/api/stream.m3u8?src=tapo" 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      ok "external endpoint healthy after $((i*5))s (via $PUB_IP)"
      HEALTHY=1
      break
    fi
  fi
  printf "  attempt %2d/18: HTTP=%s ip=%s\n" "$i" "${HTTP:-?}" "${PUB_IP:-?}"
  sleep 5
done

step "Health check"
if [ "$HEALTHY" = "1" ] && [ -x "$SCRIPT_DIR/cctv-health.sh" ] && "$SCRIPT_DIR/cctv-health.sh"; then
  notify "✅ CCTV" "Pipeline healthy" "Glass"
  exit 0
elif [ "$HEALTHY" = "1" ]; then
  # External works but health-check script unhappy with something local — still a win
  notify "✅ CCTV" "External healthy (local checks partial)" "Glass"
  exit 0
else
  notify "⚠️ CCTV" "Funnel edge ยัง sync ไม่เสร็จหลัง 90s — เช็ค tailscale status" "Sosumi"
  exit 1
fi
