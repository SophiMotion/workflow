#!/bin/bash
# ============================================================
# 启动.command — SophiMedia v2 知识库（macOS 一键启动）
# 双击此文件即可：启动服务器 + 打开浏览器 + AI 功能可用
# ============================================================

# 定位到脚本所在目录
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1

# ─── 检查 Python ───
if ! command -v python3 &>/dev/null; then
    echo "❌ 未找到 python3"
    echo "  从 https://www.python.org/downloads/ 安装"
    read -p "按回车退出... " _
    exit 1
fi

echo "========================================="
echo "  SophiMedia v2 知识库 — 一键启动"
echo "========================================="
echo ""

# ─── 第一步：强制释放端口 5000 ───
OLD_PIDS=$(lsof -ti :5000 2>/dev/null)
if [ -n "$OLD_PIDS" ]; then
    echo "🔄 正在释放端口 5000（旧进程 PID: $(echo $OLD_PIDS | tr '\n' ' ')）"
    kill -9 $OLD_PIDS 2>/dev/null
    sleep 1
    echo "   ✅ 端口已释放"
    echo ""
fi

# ─── 检查 .env ───
HAS_API_KEY=false
if [ -f .env ]; then
    KEY=$(grep "^CLAUDE_API_KEY=" .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ -n "$KEY" ] && [ "$KEY" != "sk-ant-..."]; then
        HAS_API_KEY=true
    fi
fi

if [ "$HAS_API_KEY" = false ]; then
    echo "⚠️  未配置 CLAUDE_API_KEY"
    echo "  AI 回复将使用基础模式，或可在浏览器中直接输入 API Key"
    echo "  如需提前配置，编辑 .env 文件添加你的密钥"
    echo ""
fi

# ─── 启动服务器 ───
echo "🚀 启动服务器…"
python3 v2-server.py &
SERVER_PID=$!

# 等待就绪（最多 15 秒）
echo "⏳ 等待服务器就绪…"
for i in $(seq 1 15); do
    sleep 1
    if curl -s http://localhost:5000/api/health &>/dev/null 2>&1; then
        echo "✅ 服务器已就绪 (PID: $SERVER_PID)"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo "❌ 启动超时"
        read -p "按回车查看错误信息... " _
        cat /tmp/v2-server-err.log 2>/dev/null || echo "无错误日志"
        read -p "按回车退出... " _
        exit 1
    fi
done

echo "🌐 打开浏览器…"
open "http://localhost:5000"

echo ""
echo "⭐ 按 Ctrl+C 停止服务器"
echo "   关闭此窗口不会停止服务"

wait $SERVER_PID
