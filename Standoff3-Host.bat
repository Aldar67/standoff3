@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Standoff 3 - Хост
echo ============================================================
echo   Standoff 3 - Создание игры по сети (хост)
echo ============================================================
echo.
echo Запускаю сервер...
start "Standoff 3 - файловый сервер (не закрывать)" cmd /k chcp 65001 ^&^& python -m http.server 8765 --bind 0.0.0.0
start "Standoff 3 - сетевой сервер (не закрывать)" cmd /k chcp 65001 ^&^& python server.py 8766
timeout /t 1 /nobreak >nul
echo.
echo Ваши IP-адреса в локальной сети (сообщите их другим игрокам):
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceAlias -notmatch (Loopback) -and $_.IPAddress -notlike (169.254.*) } | ForEach-Object { \"   \" + $_.IPAddress + \"  (\" + $_.InterfaceAlias + \")\" }"
echo.
echo Другие игроки: откройте игру (свой Standoff3.bat или адрес http://ВАШ_IP:8765)
echo и на вкладке "Присоединиться" впишите адрес: ws://ВАШ_IP:8766
echo.
start "" "http://localhost:8765/index.html"
echo Это окно можно свернуть, но не закрывать, пока идёт игра.
pause
