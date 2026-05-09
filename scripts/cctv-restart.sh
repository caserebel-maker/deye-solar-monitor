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
PTZ_LABEL="${PTZ_LABEL:-com.cctv.ptz}"

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

step "[3/5] Tailscale up + Funnel"
if [ -x "$TS_BIN" ] && [ -S "$TS_SOCK" ]; then
  "$TS_BIN" --socket="$TS_SOCK" up --hostname=home-macmini >/dev/null 2>&1 && ok "tailnet up"
  "$TS_BIN" --socket="$TS_SOCK" funnel --bg --https=443 "http://localhost:$GO2RTC_PORT" >/dev/null 2>&1 && ok "funnel active on :443 → :$GO2RTC_PORT"
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

step "[5/5] รอ 8 วินาทีให้ services warm-up..."
for i in 8 7 6 5 4 3 2 1; do printf "  %s..." "$i"; sleep 1; done
echo

step "Health check"
if [ -x "$SCRIPT_DIR/cctv-health.sh" ]; then
  if "$SCRIPT_DIR/cctv-health.sh"; then
    notify "✅ CCTV" "Pipeline healthy" "Glass"
    exit 0
  else
    notify "⚠️ CCTV" "บางจุดยัง fail — เปิด terminal ดู log" "Sosumi"
    exit 1
  fi
else
  warn "scripts/cctv-health.sh not found or not executable"
  notify "⚠️ CCTV" "Restart done แต่ health check script หาย" "Pop"
  exit 1
fi
