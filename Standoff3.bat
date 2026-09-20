@echo off
cd /d "%~dp0"
set "URL=file:///%~dp0index.html"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "%CHROME%" ( start "" "%CHROME%" --app="%URL%" --start-fullscreen --autoplay-policy=no-user-gesture-required & exit /b )
if exist "%CHROME86%" ( start "" "%CHROME86%" --app="%URL%" --start-fullscreen --autoplay-policy=no-user-gesture-required & exit /b )
if exist "%EDGE%" ( start "" "%EDGE%" --app="%URL%" --start-fullscreen --autoplay-policy=no-user-gesture-required & exit /b )
start "" "%URL%"
