#!/usr/bin/env python3
# ===== Standoff 3 — сборка десктоп-версии (без Node.js) =====
# Windows: берёт готовый zip Electron (electron-vX-win32-x64.zip с github.com/electron/electron/releases),
#          кладёт игру в resources/app, переименовывает electron.exe -> Standoff3.exe  ->  dist/Standoff3-win/ (+ zip)
# macOS:   собирает папку dist/Standoff3-mac/ с файлами игры и загрузчиком Standoff3-Mac.command, который уже на маке
#          сам скачает Electron под нужный процессор и соберёт Standoff 3.app (+ zip)
#
#   python build_desktop.py path/to/electron-v44.4.3-win32-x64.zip
import os, sys, shutil, zipfile, json, stat, time

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
GAME_FILES = ['index.html', 'style.css', 'src', 'lib']
SHELL_FILES = ['main.js', 'preload.js', 'package.json', 'config.json']

def version():
    with open(os.path.join(ROOT, 'src', 'game', 'config.js'), encoding='utf-8') as f:
        for line in f:
            if 'S3.VERSION' in line:
                return line.split("'")[1]
    return '0.0.0'

def copy_game(dst):
    os.makedirs(dst, exist_ok=True)
    for name in GAME_FILES:
        src = os.path.join(ROOT, name)
        if os.path.isdir(src): shutil.copytree(src, os.path.join(dst, name), ignore=shutil.ignore_patterns('__pycache__'))
        else: shutil.copy2(src, dst)
    for name in SHELL_FILES:
        shutil.copy2(os.path.join(ROOT, 'desktop', name), dst)

def copy_server(dst):
    os.makedirs(dst, exist_ok=True)
    shutil.copy2(os.path.join(ROOT, 'server.py'), dst)
    with open(os.path.join(dst, 'Standoff3-LAN-Server.bat'), 'w', encoding='utf-8', newline='\r\n') as f:
        f.write('@echo off\r\nchcp 65001 >nul\r\ntitle Standoff 3 - LAN server\r\necho Сервер для игры по локальной сети без VPS. Нужен Python 3. Не закрывайте это окно.\r\necho Адрес для подключения: ws://IP_ЭТОГО_КОМПЬЮТЕРА:8766  (свой IP: ipconfig -> IPv4)\r\npython "%~dp0server.py" 8766\r\npause\r\n')
    shutil.copy2(os.path.join(ROOT, 'vps', 'install.sh'), os.path.join(dst, 'vps-install.sh'))

def zip_dir(folder, zip_path, unix_exec=()):
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(folder):
            for fn in files:
                full = os.path.join(base, fn); rel = os.path.relpath(full, os.path.dirname(folder))
                zi = zipfile.ZipInfo(rel.replace(os.sep, '/'), time.localtime(os.path.getmtime(full))[:6])
                zi.compress_type = zipfile.ZIP_DEFLATED
                mode = 0o755 if fn.endswith(unix_exec) else 0o644
                zi.external_attr = (stat.S_IFREG | mode) << 16
                with open(full, 'rb') as f: z.writestr(zi, f.read())

def build_windows(electron_zip):
    out = os.path.join(DIST, 'Standoff3-win')
    if os.path.exists(out): shutil.rmtree(out)
    print('Windows: распаковка', electron_zip)
    with zipfile.ZipFile(electron_zip) as z: z.extractall(out)
    os.rename(os.path.join(out, 'electron.exe'), os.path.join(out, 'Standoff3.exe'))
    for junk in ['LICENSE', 'LICENSES.chromium.html', 'version']:
        p = os.path.join(out, junk)
        if os.path.exists(p): os.rename(p, os.path.join(out, 'resources', junk)) if junk != 'version' else os.remove(p)
    copy_game(os.path.join(out, 'resources', 'app'))
    shutil.copy2(os.path.join(ROOT, 'desktop', 'config.json'), out)  # редактируемый адрес сервера рядом с exe
    copy_server(os.path.join(out, 'server'))
    with open(os.path.join(out, 'ПРОЧТИ.txt'), 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(f'Standoff 3 v{version()} — Windows\r\n\r\nЗапуск: Standoff3.exe\r\n\r\nИгра по сети через VPS: адрес сервера в файле config.json (строка defaultServer), например ws://1.2.3.4:8766.\r\n'
                'Он подставляется в игре автоматически во вкладке «Игра по сети». Установка сервера на VPS: server/vps-install.sh.\r\n\r\n'
                'Игра по локальной сети без VPS: хост запускает server/Standoff3-LAN-Server.bat (нужен Python 3), остальные подключаются к ws://IP_ХОСТА:8766.\r\n')
    zip_path = os.path.join(DIST, f'Standoff3-{version()}-win64.zip')
    print('Windows: архив', zip_path); zip_dir(out, zip_path)
    return zip_path

def build_mac():
    out = os.path.join(DIST, 'Standoff3-mac')
    if os.path.exists(out): shutil.rmtree(out)
    copy_game(os.path.join(out, 'game'))
    shutil.copy2(os.path.join(ROOT, 'desktop', 'config.json'), out)
    shutil.copy2(os.path.join(ROOT, 'desktop', 'Standoff3-Mac.command'), out)
    copy_server(os.path.join(out, 'server'))
    with open(os.path.join(out, 'ПРОЧТИ.txt'), 'w', encoding='utf-8') as f:
        f.write(f'Standoff 3 v{version()} — macOS\n\nЗапуск: двойной клик по Standoff3-Mac.command (при первом запуске: ПКМ → «Открыть»).\n'
                'Загрузчик один раз скачает Electron (~130 МБ) и соберёт Standoff 3.app в этой папке; дальше запускайте любой из них.\n\n'
                'Адрес VPS-сервера — в config.json (строка defaultServer), например ws://1.2.3.4:8766.\n')
    zip_path = os.path.join(DIST, f'Standoff3-{version()}-mac.zip')
    print('macOS: архив', zip_path); zip_dir(out, zip_path, unix_exec=('.command', '.sh'))
    return zip_path

if __name__ == '__main__':
    os.makedirs(DIST, exist_ok=True)
    if len(sys.argv) > 1: build_windows(sys.argv[1])
    else: print('Electron zip для Windows не указан — собираю только macOS-пакет.')
    build_mac()
    print('Готово: папка dist/')
