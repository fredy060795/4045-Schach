@echo off
title Schach-Server (Port 5045)
cd /d "%~dp0"
set PORT=5045

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
    goto ende
)

python --version >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto ende
)

echo.
echo Python wurde nicht gefunden.
echo Bitte Python 3 installieren: https://www.python.org/downloads/
echo (Beim Installieren "Add python.exe to PATH" anhaken.)
echo.

:ende
pause
