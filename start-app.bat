@echo off
title Image Library Launcher v2.8.3

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
echo =                   Clearing Browser Cache...                   =
echo =================================================================

REM Clear browser cache directories for common browsers
echo Clearing Chrome cache...
if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" (
    rd /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache" 2>nul
)
if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Code Cache" (
    rd /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Code Cache" 2>nul
)

echo Clearing Edge cache...
if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" (
    rd /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache" 2>nul
)
if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Code Cache" (
    rd /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Code Cache" 2>nul
)

echo Clearing Firefox cache...
if exist "%LOCALAPPDATA%\Mozilla\Firefox\Profiles" (
    for /d %%i in ("%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*") do (
        if exist "%%i\cache2" rd /s /q "%%i\cache2" 2>nul
    )
)

echo Cache clearing completed.
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

echo Starting HTTP server on port 8080...
echo.
echo Available on:
echo   http://192.168.10.92:8080
echo   http://127.0.0.1:8080
echo   http://172.26.208.1:8080
echo   http://localhost:8080
echo.
echo Hit CTRL-C to stop the server
echo.
echo =================================================================

npx http-server -p 8080 -c-1

