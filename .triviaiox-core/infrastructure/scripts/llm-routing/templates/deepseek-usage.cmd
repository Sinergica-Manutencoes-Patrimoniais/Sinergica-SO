@echo off
:: DeepSeek Usage Statistics CLI
:: View usage tracking data per alias

setlocal

:: Try multiple locations for the tracker script
:: 1. Environment variable (if set during installation)
if defined TRIVIAIOX_HOME (
    set "TRACKER_SCRIPT=%TRIVIAIOX_HOME%\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\index.js"
    if exist "%TRACKER_SCRIPT%" goto :found
)

:: 2. Common installation locations
set "TRACKER_SCRIPT=%USERPROFILE%\triviaiox-core\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\index.js"
if exist "%TRACKER_SCRIPT%" goto :found

set "TRACKER_SCRIPT=%USERPROFILE%\Workspaces\TRIVIAIOX\Trivia-Growth\triviaiox-core\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\index.js"
if exist "%TRACKER_SCRIPT%" goto :found

:: 3. Relative to this script (for development)
set "TRACKER_SCRIPT=%~dp0..\usage-tracker\index.js"
if exist "%TRACKER_SCRIPT%" goto :found

:: 4. Global npm package location
set "TRACKER_SCRIPT=%APPDATA%\npm\node_modules\@triviaiox-fullstack\core\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\index.js"
if exist "%TRACKER_SCRIPT%" goto :found

echo [91mERROR: Usage tracker not found![0m
echo.
echo Please ensure TRIVIAIOX is installed correctly.
echo Expected locations:
echo   - %%TRIVIAIOX_HOME%%\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\
echo   - %%USERPROFILE%%\triviaiox-core\.triviaiox-core\infrastructure\scripts\llm-routing\usage-tracker\
echo.
echo Set TRIVIAIOX_HOME environment variable: setx TRIVIAIOX_HOME "C:\path\to\triviaiox-core"
exit /b 1

:found
:: Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [91mERROR: Node.js not found in PATH[0m
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Pass arguments to tracker
node "%TRACKER_SCRIPT%" usage %*

endlocal
