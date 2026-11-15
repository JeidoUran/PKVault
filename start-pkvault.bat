@echo off
setlocal

rem Resolve the repository from this file, including paths with spaces/accents.
set "PKVAULT_DIR=%~dp0"
set "PKVAULT_TERMINAL=%LOCALAPPDATA%\Microsoft\WindowsApps\Microsoft.IntelligentTerminal_8wekyb3d8bbwe\wtai.exe"

if not exist "%PKVAULT_DIR%PKVault.Backend\PKVault.Backend.csproj" (
    echo Place ce fichier dans le dossier racine du depot PKVault.
    pause
    exit /b 1
)

if not exist "%PKVAULT_TERMINAL%" (
    echo Intelligent Terminal est introuvable sur ce PC.
    pause
    exit /b 1
)

rem A single invocation creates both tabs in the same new window.
"%PKVAULT_TERMINAL%" -w new new-tab --title "PKVault - Serveur" --suppressApplicationTitle -d "%PKVAULT_DIR%." cmd.exe /d /k dotnet run --project PKVault.Backend ; new-tab --title "PKVault - Interface" --suppressApplicationTitle -d "%PKVAULT_DIR%." cmd.exe /d /k npm.cmd --prefix frontend run dev -- --host 127.0.0.1

if errorlevel 1 (
    echo Impossible de lancer PKVault dans Intelligent Terminal.
    pause
    exit /b 1
)

endlocal
