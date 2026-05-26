#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

POND_USER="${POND_USER:-pond}"
HEALTH_PORT="${HEALTH_PORT:-8099}"
SSH_PORT="${SSH_PORT:-2222}"
HEALTH_PATH="${HEALTH_PATH:-/pond-health}"
MAC_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPZQuHB8H2XLTIQln3dFpaDO6Th0+LnB2yfv38sfN+xJ pondm1-to-pond-server"

echo "== Pond Ubuntu remote health setup =="

echo "[1/6] Installing tools..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y curl lm-sensors smartmontools openssh-server

echo "[2/6] Enabling CPU temperature driver..."
modprobe coretemp 2>/dev/null || true
printf "coretemp\n" >/etc/modules-load.d/coretemp.conf

echo "[3/6] Allowing this Mac to SSH in..."
install -d -m 700 -o "$POND_USER" -g "$POND_USER" "/home/$POND_USER/.ssh"
touch "/home/$POND_USER/.ssh/authorized_keys"
grep -qxF "$MAC_PUBLIC_KEY" "/home/$POND_USER/.ssh/authorized_keys" || echo "$MAC_PUBLIC_KEY" >>"/home/$POND_USER/.ssh/authorized_keys"
chown "$POND_USER:$POND_USER" "/home/$POND_USER/.ssh/authorized_keys"
chmod 600 "/home/$POND_USER/.ssh/authorized_keys"

cat >/etc/ssh/sshd_config.d/99-pond-remote.conf <<EOF
Port 22
Port $SSH_PORT
PubkeyAuthentication yes
PasswordAuthentication yes
EOF
systemctl enable --now ssh
systemctl restart ssh

if command -v ufw >/dev/null 2>&1; then
  ufw allow "$SSH_PORT/tcp" || true
  ufw allow "$HEALTH_PORT/tcp" || true
fi

echo "[4/6] Creating health page..."
cat >/usr/local/bin/pond-health.py <<'PY'
#!/usr/bin/env python3
import json
import os
import platform
import socket
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("HEALTH_PORT", "8099"))


def run(cmd, timeout=4):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True, timeout=timeout).strip()
    except Exception as exc:
        return f"unavailable: {exc}"


def thermal_zones():
    zones = []
    for temp_file in sorted(Path("/sys/class/thermal").glob("thermal_zone*/temp")):
        zone_dir = temp_file.parent
        try:
            raw = temp_file.read_text().strip()
            temp_c = round(int(raw) / 1000, 1)
        except Exception:
            continue
        kind_file = zone_dir / "type"
        kind = kind_file.read_text().strip() if kind_file.exists() else zone_dir.name
        zones.append({"name": zone_dir.name, "type": kind, "celsius": temp_c})
    return zones


def sensors_text():
    if not subprocess.call("command -v sensors >/dev/null 2>&1", shell=True) == 0:
        return ""
    return run("sensors", timeout=5)


def service(name):
    state = run(f"systemctl is-active {name}", timeout=2)
    enabled = run(f"systemctl is-enabled {name}", timeout=2)
    return {"active": state, "enabled": enabled}


def snapshot():
    return {
        "hostname": socket.gethostname(),
        "time": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "os": platform.platform(),
        "uptime": run("uptime -p"),
        "load": os.getloadavg(),
        "temps": thermal_zones(),
        "sensors": sensors_text(),
        "disk": run("df -h / | tail -1"),
        "memory": run("free -h | awk '/Mem:/ {print $3 \" / \" $2}'"),
        "services": {
            "tailscaled": service("tailscaled"),
            "ssh": service("ssh"),
            "docker": service("docker"),
            "cctv-onvif-forward": service("cctv-onvif-forward"),
            "pond-health": service("pond-health"),
        },
        "ports": run("ss -ltnp | grep -E ':(2020|2222|8099)\\b' || true"),
    }


def render_text(data):
    lines = [
        "Pond Ubuntu Health",
        "==================",
        f"Host: {data['hostname']}",
        f"Time: {data['time']}",
        f"OS: {data['os']}",
        f"Uptime: {data['uptime']}",
        f"Memory: {data['memory']}",
        f"Disk /: {data['disk']}",
        "",
        "Temperatures:",
    ]
    if data["temps"]:
        for item in data["temps"]:
            lines.append(f"- {item['type']} ({item['name']}): {item['celsius']} C")
    else:
        lines.append("- No /sys thermal sensors found")
    if data["sensors"]:
        lines += ["", "Sensors:", data["sensors"]]
    lines.append("")
    lines.append("Services:")
    for name, state in data["services"].items():
        lines.append(f"- {name}: {state['active']} / {state['enabled']}")
    lines += ["", "Listening ports:", data["ports"] or "- none"]
    return "\n".join(lines) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = snapshot()
        if self.path.startswith("/json"):
            body = json.dumps(data, ensure_ascii=False, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
        else:
            body = render_text(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
PY
chmod +x /usr/local/bin/pond-health.py

cat >/etc/systemd/system/pond-health.service <<EOF
[Unit]
Description=Pond server health and temperature page
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
Environment=HEALTH_PORT=$HEALTH_PORT
ExecStart=/usr/local/bin/pond-health.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "[5/6] Starting services..."
systemctl daemon-reload
systemctl enable --now pond-health
systemctl restart pond-health

echo "[6/6] Publishing health page through Tailscale Funnel..."
if command -v tailscale >/dev/null 2>&1; then
  tailscale serve --bg --yes --set-path "$HEALTH_PATH" "$HEALTH_PORT" || true
  tailscale funnel --bg --yes --set-path "$HEALTH_PATH" "$HEALTH_PORT" || true
fi

TAIL_HOST="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("Self",{}).get("DNSName","").rstrip("."))' 2>/dev/null || true)"
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

echo
echo "== Done =="
echo "Local health URL:"
echo "  http://${LOCAL_IP:-SERVER-IP}:$HEALTH_PORT/"
if [ -n "$TAIL_HOST" ]; then
  echo "Tailscale/Funnel health URL:"
  echo "  https://$TAIL_HOST$HEALTH_PATH"
fi
echo
echo "SSH backup port:"
echo "  $SSH_PORT"
echo
echo "Quick local test:"
curl -fsS "http://127.0.0.1:$HEALTH_PORT/" || true
