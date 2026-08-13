@echo off
title POS Kasir - Auto Run
color 0A

echo ============================================
echo        POS KASIR - AUTO RUN
echo ============================================
echo.

:: Set path ke folder project
cd /d "%~dp0"

:: Cek apakah node_modules ada
if not exist "node_modules" (
    echo [INFO] Menginstall dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] Gagal menginstall dependencies!
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Dependencies berhasil diinstall.
    echo.
)

:: Kill proses node/npm sebelumnya agar port 3000 bersih
echo [INFO] Membersihkan proses sebelumnya...
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Jalankan development server di background (window tersembunyi)
echo [INFO] Menjalankan server di http://localhost:3000...
start /min cmd /c "title POS Server && npm run dev"

:: Tunggu sebentar sampai server siap
echo [INFO] Menunggu server siap...
timeout /t 4 /nobreak >nul

:: Buka Microsoft Edge ke localhost:3000
echo [INFO] Membuka Microsoft Edge...
start msedge.exe --new-window --start-fullscreen --kiosk http://localhost:3000
REM Jika Edge tidak ada, fallback ke browser default:
REM start http://localhost:3000

echo.
echo [SUCCESS] Server berjalan! Aplikasi terbuka di Edge.
echo [INFO] Untuk menutup, tekan Ctrl+C di jendela ini.
echo.

:: Tunggu user menekan tombol untuk menutup
pause >nul

:: Saat user menekan tombol, matikan server
echo [INFO] Mematikan server...
taskkill /f /im node.exe >nul 2>&1
echo [INFO] Server dimatikan. Sampai jumpa!
timeout /t 2 /nobreak >nul