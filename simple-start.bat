@echo off
title Image Library - Simple Launcher v2.12.0

echo.
echo ========================================
echo   IMAGE LIBRARY v2.12.0 - STARTING
echo ========================================
echo.

echo [1/5] Stopping existing servers...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM http-server.exe >nul 2>&1
echo     Existing processes stopped.

echo.
echo [2/5] Starting backend server...
cd backend
start "Image Library Backend" cmd /k "echo Backend Server Starting... && node server.js"
cd ..
echo     Backend server launched.

echo.
echo [3/5] Waiting for backend to initialize...
timeout /t 5 /nobreak >nul
echo     Backend should be ready.

echo.
echo [4/5] Starting frontend server...
start "Image Library Frontend" cmd /k "echo Frontend Server Starting... && npx http-server -p 8080 -c-1"
echo     Frontend server launched.

echo.
echo [5/5] Opening application in browser...
timeout /t 3 /nobreak >nul
start http://localhost:8080
echo     Browser opened.

echo.
echo ========================================
echo   APPLICATION STARTED SUCCESSFULLY!
echo ========================================
echo.
echo Frontend: http://localhost:8080
echo Backend:  http://localhost:3000
echo.
echo Features Available:
echo - Image Upload and Management
echo - Tag-based Search and Selection
echo - Project Creation and Management
echo - EMAIL SHARING with embedded images
echo - Selection Pool with Navigation
echo - Full-size Image Preview with Pan/Zoom
echo.
echo Keep the Backend and Frontend windows open.
echo Close this window when done.
echo.
pause
