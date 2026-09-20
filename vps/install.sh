#!/bin/bash
# ===== Standoff 3 — установка релей-сервера на VPS (Ubuntu/Debian, от root) =====
# Что делает: кладёт server.py в /opt/standoff3, создаёт службу systemd (автозапуск, перезапуск при сбое),
# открывает порт 8766 в ufw (если ufw установлен). Игрокам после этого нужен только адрес ws://IP_VPS:8766.
#
# Использование (с вашего компьютера, из папки игры):
#   scp server.py vps/install.sh root@IP_VPS:/root/
#   ssh root@IP_VPS 'bash /root/install.sh'
set -e
PORT="${1:-8766}"
DIR=/opt/standoff3
command -v python3 >/dev/null || { apt-get update && apt-get install -y python3; }
mkdir -p "$DIR"
cp "$(dirname "$0")/server.py" "$DIR/server.py"
cat > /etc/systemd/system/standoff3.service <<EOF
[Unit]
Description=Standoff 3 relay server (WebSocket, port ${PORT})
After=network.target

[Service]
ExecStart=/usr/bin/python3 ${DIR}/server.py ${PORT}
WorkingDirectory=${DIR}
Restart=always
RestartSec=2
User=nobody
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now standoff3
if command -v ufw >/dev/null; then ufw allow "${PORT}/tcp" >/dev/null && echo "ufw: порт ${PORT}/tcp открыт"; fi
sleep 1
systemctl --no-pager --lines=5 status standoff3 || true
IP=$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo
echo "Готово. Адрес для игры:  ws://${IP}:${PORT}"
echo "Логи:  journalctl -u standoff3 -f      Перезапуск:  systemctl restart standoff3"
echo "Если у хостера есть свой файрвол (панель управления) — откройте там TCP ${PORT}."
