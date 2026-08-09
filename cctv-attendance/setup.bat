@echo off
:: ============================================================
::  Paradigm CCTV Attendance — Setup Script
::  Run once to install Python dependencies and create .env
:: ============================================================

echo.
echo  ======================================================
echo   Paradigm CCTV Attendance Edge Server — Setup
echo  ======================================================
echo.

:: Check Python version
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found! Please install Python 3.10+ from python.org
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version') do set PY_VER=%%v
echo  [OK] Python %PY_VER% found

:: Create virtual environment
if not exist "venv" (
    echo  [SETUP] Creating virtual environment...
    python -m venv venv
    echo  [OK] Virtual environment created
) else (
    echo  [OK] Virtual environment already exists
)

:: Activate venv and install dependencies
echo  [SETUP] Installing dependencies (this may take 2-5 minutes)...
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

if %errorlevel% neq 0 (
    echo  [ERROR] Dependency installation failed!
    pause
    exit /b 1
)
echo  [OK] Dependencies installed

:: Create .env if it doesn't exist
if not exist ".env" (
    echo  [SETUP] Creating .env from template...
    copy .env.example .env
    echo.
    echo  [ACTION REQUIRED] Please edit .env with your settings:
    echo    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    echo    - CAMERAS (RTSP URLs for your cameras)
    echo    - EDGE_DEVICE_ID (unique ID for this server)
    echo.
    notepad .env
) else (
    echo  [OK] .env already exists
)

:: Create required directories
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "snapshots" mkdir snapshots
if not exist "models" mkdir models
echo  [OK] Directories created

:: Download InsightFace models (first-time, ~130 MB)
echo  [SETUP] Pre-downloading InsightFace models (buffalo_l, ~130 MB)...
call venv\Scripts\python.exe -c "from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_l', root='./models', providers=['CPUExecutionProvider']); app.prepare(ctx_id=-1, det_size=(640,640)); print('[OK] Models downloaded')"

echo.
echo  ======================================================
echo   Setup Complete!
echo   Run start.bat to start the CCTV attendance server
echo  ======================================================
echo.
pause
