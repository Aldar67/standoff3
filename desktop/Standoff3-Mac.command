#!/bin/bash
# ===== Standoff 3 — загрузчик для macOS =====
# Двойной клик по этому файлу: скачивает Electron под ваш процессор (Intel / Apple Silicon),
# собирает "Standoff 3.app" рядом с этим файлом и запускает игру. Повторный запуск — просто открывает игру.
# Если macOS пишет, что файл "не может быть открыт": ПКМ по файлу → «Открыть» (один раз).
set -e
cd "$(dirname "$0")"
ELECTRON_VER="44.4.3"
APP="Standoff 3.app"
GAME_SRC="game"

if [ ! -d "$GAME_SRC" ]; then echo "Папка '$GAME_SRC' с файлами игры не найдена рядом со скриптом."; read -p "Enter для выхода"; exit 1; fi

if [ ! -d "$APP" ] || [ "$GAME_SRC/src/game/config.js" -nt "$APP/Contents/Resources/app/src/game/config.js" ]; then
  ARCH="x64"; [ "$(uname -m)" = "arm64" ] && ARCH="arm64"
  ZIP="electron-v${ELECTRON_VER}-darwin-${ARCH}.zip"
  if [ ! -f "$ZIP" ]; then
    echo "Скачиваю Electron ${ELECTRON_VER} (${ARCH}, ~130 МБ)..."
    curl -L --progress-bar -o "$ZIP" "https://github.com/electron/electron/releases/download/v${ELECTRON_VER}/${ZIP}"
  fi
  echo "Собираю ${APP}..."
  rm -rf "$APP" "Electron.app"
  ditto -x -k "$ZIP" .            # ditto сохраняет симлинки и права внутри .app
  mv "Electron.app" "$APP"
  APPDIR="$APP/Contents/Resources/app"
  mkdir -p "$APPDIR"
  cp -R "$GAME_SRC"/. "$APPDIR"/
  # имя в Dock / заголовке
  /usr/libexec/PlistBuddy -c "Set :CFBundleName Standoff 3" "$APP/Contents/Info.plist" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Standoff 3" "$APP/Contents/Info.plist" 2>/dev/null || true
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
  echo "Готово."
fi
open "$APP"
