@echo off
title Paradigm Office - Work Laptop Productivity Companion
echo ========================================================
echo   Paradigm Work Laptop Productivity Agent
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0agent.ps1" %*

pause
