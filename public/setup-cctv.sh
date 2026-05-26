#!/bin/bash
set -e

echo "=== CCTV ONVIF Port Forwarder Setup ==="

echo "[1/4] Installing socat..."
sudo apt-get update && sudo apt-get install -y socat ffmpeg

echo "[2/4] Stopping existing services..."
sudo systemctl stop cctv-onvif-forward 2>/dev/null || true
sudo fuser -k 2020/tcp 2>/dev/null || true

echo "[3/4] Creating systemd service file..."
sudo tee /etc/systemd/system/cctv-onvif-forward.service >/dev/null <<'EOF'
[Unit]
Description=Forward ONVIF/PTZ port 2020 to Tapo camera 192.168.1.106
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/socat -d -d TCP-LISTEN:2020,fork,reuseaddr,bind=0.0.0.0 TCP:192.168.1.106:2020
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "[4/4] Activating and starting systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable --now cctv-onvif-forward

echo "=== Verification ==="
sudo ss -ltnp | grep ':2020' || echo "Port 2020 is not listening!"
sudo systemctl status cctv-onvif-forward --no-pager

echo "========================================="
echo "Setup complete! Test PTZ controls now."
echo "========================================="
