@echo off
title Instalator PDF Splitter
echo ===================================================
echo   Rozpoczynam instalacje PDF AI Splitter...
echo ===================================================
echo   Za chwile otworzy sie okno PowerShell.
echo   Zaakceptuj prosbe o uprawnienia administratora.
echo ===================================================
echo.

:: Uruchamiamy instalację pobierając skrypt install-remote.ps1 bezpośrednio z GitHub-a
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/ArturGilowski/PDFsplitter/main/install-remote.ps1 | iex"

echo.
echo Instalacja zakonczona! Mozesz zamknac to okno.
pause > nul
