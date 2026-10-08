@echo off
title Storage Audit & Cleaner
color 0B

cd /d "%~dp0"

echo ============================================================
echo   MEMBUKA STORAGE AUDIT & CLEANER DASHBOARD...
echo ============================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js tidak ditemukan di komputer ini!
    echo Silakan install Node.js terlebih dahulu dari https://nodejs.org
    echo.
    pause
    exit /b
)

:: Membersihkan proses port 3000 lama jika masih tertahan
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [OK] Runtime Node.js siap.
echo [OK] Membuka server dan dashboard browser di http://localhost:3000 ...
echo.
echo ============================================================
echo   Tutup jendela ini atau tekan Ctrl+C jika ingin keluar
echo ============================================================
echo.

node storage_audit.js
pause
