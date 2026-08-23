@echo off
title Verdad Solution InventoryApp
echo ========================================================
echo   Starting Verdad Solution InventoryApp (React + MySQL)
echo ========================================================
echo.
echo Checking Python runtime...
"C:\Program Files\Python314\python.exe" --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting server on http://localhost:5000 ...
    "C:\Program Files\Python314\python.exe" server.py
) else (
    python --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Starting server on http://localhost:5000 ...
        python server.py
    ) else (
        echo [ERROR] Python not found. Please install Python or Node.js to run the server.
        pause
    )
)
pause
