@echo off
echo Installing dependencies...
call npm install
echo.
echo Starting the web server...
echo You can access the application at http://127.0.0.1:8080
call npm start
