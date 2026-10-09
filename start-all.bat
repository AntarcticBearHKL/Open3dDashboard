@echo off
rem 后台启动：前端 + Blender 桥 + Unity 桥（纯 Python，无控制台窗口）。停止用 stop-all.bat。
cd /d "%~dp0"
start "" pythonw "%~dp0start.py"
exit /b
