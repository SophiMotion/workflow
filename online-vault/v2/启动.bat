@echo off
REM ============================================================
REM 启动.bat — SophiMedia v2 知识库（Windows 一键启动）
REM 双击此文件即可：启动服务器 + 打开浏览器 + AI 功能可用
REM ============================================================

cd /d "%~dp0"

REM ─── 检查 Python ───
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    python3 --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo 错误：未找到 Python
        echo 请到 https://www.python.org/downloads/ 安装
        pause
        exit /b 1
    )
    set PY=python3
) else (
    set PY=python
)

REM ─── 检查端口 ───
netstat -an 2>nul | find ":5000 " >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ⚠️ 服务器可能已在运行，直接打开浏览器…
    timeout /t 2 >nul
    start http://localhost:5000
    exit /b 0
)

echo ========================================
echo   SophiMedia v2 知识库
echo ========================================
echo.
echo 🚀 启动服务器：%PY% v2-server.py
start /B "" %PY% v2-server.py

echo ⏳ 等待服务器启动（约 3 秒）…
timeout /t 3 >nul

echo 🌐 打开浏览器…
start http://localhost:5000

echo.
echo 📌 提示：关闭此窗口不会停止服务器
echo    如需停止，打开任务管理器结束 python 进程
echo.
pause
