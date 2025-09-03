@echo off
title Image Library Launcher v2.3.0

echo.
echo =================================================================
echo =           Stopping any running servers on port 3000 & 8080...           =
echo =================================================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    echo Killing process with PID %%a on port 3000
    taskkill /F /PID %%a
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080"') do (
    echo Killing process with PID %%a on port 8080
    taskkill /F /PID %%a
)

echo.
echo =================================================================
echo =                  Starting Backend Server...                   =
echo =================================================================
echo.

cd backend
start "Backend Server" cmd /c "npm start"
cd ..

echo.
echo Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo =================================================================
echo =                 Starting Frontend Server...                  =
echo =================================================================
echo.

npm start

