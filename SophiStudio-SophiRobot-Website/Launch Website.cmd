@echo off
setlocal
cd /d "%~dp0"
set "PROFABX_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "PROFABX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if "%PROFABX_NODE%"=="node" goto launch
if exist "%PROFABX_NODE%" goto launch
echo Node.js was not found. Install Node.js 22 or later from https://nodejs.org
pause
exit /b 1
:launch
"%PROFABX_NODE%" scripts\serve.cjs --open
if errorlevel 1 pause
