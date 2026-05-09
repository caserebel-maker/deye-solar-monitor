#!/usr/bin/env bash
# CCTV watchdog — run every 5 min by LaunchAgent com.ebci.cctv-watchdog
#
# Behavior:
#   - quick external probe of Funnel HLS endpoint
#   - if down: trigger cctv-restart.sh (once), notify, set state
#   - if down + state file present: notify only (no restart loop)
#   - if up: clear state

set -u

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STATE_FILE="/tmp/cctv-watchdog.state"
LOG="/tmp/cctv-watchdog.log"
FUNNEL_HOST="${FUNNEL_HOST:-home-macmini.tail1d5579.ts.net}"

ts() { TZ=Asia/Bangkok date "+%F %H:%M:%S"; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

notify() {
  local title="$1" msg="$2" sound="${3:-Pop}"
  osascript -e "display notification \"$msg\" with title \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

# Resolve via public DNS so we hit the actual Funnel IP, not Tailscale internal
PUB_IP=$(dig +short +time=3 A "$FUNNEL_HOST" @8.8.8.8 2>/dev/null | head -1)

if [ -z "$PUB_IP" ]; then
  log "DNS lookup for $FUNNEL_HOST failed — likely network blip, skipping"
  exit 0
fi

# Probe HLS endpoint + verify a real video segment is downloadable
HTTP=$(curl -s -m 8 --resolve "$FUNNEL_HOST:443:$PUB_IP" \
  -o /dev/null -w '%{http_code}' \
  "https://$FUNNEL_HOST/api/stream.m3u8?src=tapo" 2>/dev/null || echo "000")

if [ "$HTTP" != "200" ]; then
  log "FAIL: m3u8 HTTP=$HTTP (PUB_IP=$PUB_IP)"

  if [ -f "$STATE_FILE" ]; then
    # Already restarted in a previous cycle — alert only, no restart loop
    PREV=$(cat "$STATE_FILE")
    log "still failing since $PREV — not restarting again"
    notify "🚨 CCTV watchdog" "Pipeline ยัง down หลัง auto-restart — เช็ค Mac mini" "Sosumi"
    exit 1
  fi

  # First failure — trigger restart
  echo "$(ts)" > "$STATE_FILE"
  log "first fail — running cctv-restart.sh"
  notify "🔄 CCTV watchdog" "ตรวจพบ pipeline down — auto-restart…" "Pop"
  bash "$SCRIPT_DIR/cctv-restart.sh" >> "$LOG" 2>&1 || true
  exit 0
fi

# Healthy
if [ -f "$STATE_FILE" ]; then
  rm -f "$STATE_FILE"
  log "RECOVERED — pipeline healthy again"
  notify "✅ CCTV watchdog" "Pipeline กลับมาแล้ว" "Glass"
fi

# Trim log if it gets large
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 524288 ]; then
  tail -c 262144 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
