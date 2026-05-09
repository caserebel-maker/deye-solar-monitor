#!/usr/bin/env bash
# Double-click wrapper — Finder จะเปิด Terminal รัน script นี้ให้
# ทำให้ cctv-restart.sh กดได้ผ่าน Finder ไม่ต้องเปิด terminal เอง

cd "$(dirname "$0")"
bash ./cctv-restart.sh
echo
echo "───────────────────────────────────────────"
echo "เสร็จแล้ว — กด Cmd+W ปิดหน้าต่างนี้ได้"
echo "───────────────────────────────────────────"
