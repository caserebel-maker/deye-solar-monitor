#!/usr/bin/env bash
# CCTV watchdog — run every minute by LaunchAgent com.ebci.cctv-watchdog
#
# Two-layer health probe (the manifest can return 200 while video bytes are
# wedged — see Tapo C545D RTSP wedge mode):
#   1. Master manifest reachable + parseable
#   2. Sub-playlist MEDIA-SEQUENCE has advanced since the previous run
#
# Either signal failing → trigger cctv-restart.sh (once), notify, set state.

set -u

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STATE_FILE="/tmp/cctv-watchdog.state"
SEQ_FILE="/tmp/cctv-watchdog.last-seq"
LOG="/tmp/cctv-watchdog.log"
FUNNEL_HOST="${FUNNEL_HOST:-home-macmini.tail1d5579.ts.net}"

ts() { TZ=Asia/Bangkok date "+%F %H:%M:%S"; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

notify() {
  local title="$1" msg="$2" sound="${3:-Pop}"
  osascript -e "display notification \"$msg\" with title \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

trigger_restart() {
  local reason="$1"
  log "FAIL: $reason"

  if [ -f "$STATE_FILE" ]; then
    PREV=$(cat "$STATE_FILE")
    log "still failing since $PREV — not restarting again"
    notify "🚨 CCTV watchdog" "Pipeline ยัง down หลัง auto-restart — เช็ค Mac mini" "Sosumi"
    exit 1
  fi

  echo "$(ts)" > "$STATE_FILE"
  rm -f "$SEQ_FILE"
  log "first fail ($reason) — running cctv-restart.sh"
  notify "🔄 CCTV watchdog" "ตรวจพบ pipeline down — auto-restart…" "Pop"
  bash "$SCRIPT_DIR/cctv-restart.sh" >> "$LOG" 2>&1 || true
  exit 0
}

# Resolve via public DNS so we hit the actual Funnel IP, not Tailscale internal
PUB_IP=$(dig +short +time=3 A "$FUNNEL_HOST" @8.8.8.8 2>/dev/null | head -1)
if [ -z "$PUB_IP" ]; then
  log "DNS lookup for $FUNNEL_HOST failed — likely network blip, skipping"
  exit 0
fi

CURL=(curl -s -m 8 --resolve "$FUNNEL_HOST:443:$PUB_IP")

# Layer 1 — master manifest reachable
MASTER=$("${CURL[@]}" -w '\nHTTP_CODE:%{http_code}' \
  "https://$FUNNEL_HOST/api/stream.m3u8?src=tapo" 2>/dev/null || true)
HTTP=$(printf '%s' "$MASTER" | awk -F: '/^HTTP_CODE:/ {print $2}')
if [ "$HTTP" != "200" ]; then
  trigger_restart "master m3u8 HTTP=$HTTP"
fi

SUB_REL=$(printf '%s' "$MASTER" | awk '/^[^#]/ && /playlist.m3u8/ {print; exit}')
if [ -z "$SUB_REL" ]; then
  trigger_restart "master m3u8 missing sub-playlist pointer"
fi

# Layer 2 — sub-playlist MEDIA-SEQUENCE advancing
SUB=$("${CURL[@]}" "https://$FUNNEL_HOST/api/$SUB_REL" 2>/dev/null || true)
SEQ=$(printf '%s' "$SUB" | awk -F: '/^#EXT-X-MEDIA-SEQUENCE:/ {print $2; exit}' | tr -d '[:space:]')

if [ -z "$SEQ" ]; then
  trigger_restart "sub-playlist missing MEDIA-SEQUENCE (wedged)"
fi

LAST_SEQ=$(cat "$SEQ_FILE" 2>/dev/null || echo "")
echo "$SEQ" > "$SEQ_FILE"

if [ -n "$LAST_SEQ" ] && [ "$SEQ" = "$LAST_SEQ" ]; then
  # Two consecutive minutes with identical sequence number = no new segments
  trigger_restart "MEDIA-SEQUENCE frozen at $SEQ for ≥ 60s"
fi

# Healthy
if [ -f "$STATE_FILE" ]; then
  rm -f "$STATE_FILE"
  log "RECOVERED — pipeline healthy again (seq=$SEQ)"
  notify "✅ CCTV watchdog" "Pipeline กลับมาแล้ว" "Glass"
fi

# Trim log if it gets large
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 524288 ]; then
  tail -c 262144 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
