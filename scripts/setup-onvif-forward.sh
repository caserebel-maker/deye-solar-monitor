#!/usr/bin/env bash
set -euo pipefail

CAMERA_IP="192.168.1.106"
PORT="2020"
SERVICE="cctv-onvif-forward"

echo "Installing socat..."
sudo apt-get update
sudo apt-get install -y socat psmisc iproute2

echo "Stopping old forwarder..."
sudo systemctl stop "${SERVICE}" 2>/dev/null || true
sudo fuser -k "${PORT}/tcp" 2>/dev/null || true

echo "Writing ${SERVICE}.service..."
sudo tee "/etc/systemd/system/${SERVICE}.service" >/dev/null <<EOF
[Unit]
Description=Forward ONVIF/PTZ port ${PORT} to Tapo camera ${CAMERA_IP}
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/socat -d -d TCP-LISTEN:${PORT},fork,reuseaddr,bind=0.0.0.0 TCP:${CAMERA_IP}:${PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "Starting forwarder..."
sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE}"
sleep 1

echo "--- LISTEN CHECK ---"
sudo ss -ltnp | grep ":${PORT}" || true

echo "--- SERVICE STATUS ---"
sudo systemctl --no-pager --full status "${SERVICE}" || true

echo "DONE"
