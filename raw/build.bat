@echo off
setlocal
cd /d "%~dp0"
title FLOAT.FILE - build

echo.
echo  ==== FLOAT.FILE: building FLOAT.FILE.exe ====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] Node.js was not found. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

echo  [1/3] Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo  [2/3] Building the app and packaging it into an .exe...
call npm run dist
if errorlevel 1 (
  echo.
  echo  Packaging failed ^(often a Windows symlink permission issue with the exe icon^).
  echo  Retrying without editing the exe icon...
  echo  ^(The exe will then show up as "Electron" in Task Manager. To avoid that, turn on
  echo  Developer Mode in Windows settings or run this file as administrator, then build again.^)
  call npm run dist:nosign
  if errorlevel 1 goto :fail
)

echo.
echo  [3/3] Done.
if exist "release\FLOAT.FILE.exe" (
  copy /y "release\FLOAT.FILE.exe" "FLOAT.FILE.exe" >nul
  echo  Your app: %~dp0FLOAT.FILE.exe
  explorer /select,"%~dp0FLOAT.FILE.exe"
) else (
  echo  [!] Build finished but release\FLOAT.FILE.exe was not found.
  goto :fail
)
echo.
pause
exit /b 0

:fail
echo.
echo  [!] Build failed. Scroll up for the error message.
pause
exit /b 1
