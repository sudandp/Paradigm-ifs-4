@echo off
:: ============================================================
::  Paradigm CCTV Attendance — Start Script
::  Starts the edge server in the foreground
:: ============================================================

echo.
echo  ======================================================
echo   Paradigm CCTV Attendance Edge Server — Starting
echo  ======================================================
echo.

:: Check that venv exists
if not exist "venv\Scripts\activate.bat" (
    echo  [ERROR] Virtual environment not found. Run setup.bat first!
    pause
    exit /b 1
)

:: Check that .env exists
if not exist ".env" (
    echo  [ERROR] .env not found. Run setup.bat first!
    pause
    exit /b 1
)

:: Activate venv and start
call venv\Scripts\activate.bat
echo  [START] Starting server... (Admin dashboard at http://localhost:4100)
echo  [START] Press Ctrl+C to stop
echo.
python main.py

pause
