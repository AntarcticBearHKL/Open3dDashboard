@echo off
rem 后台启动前端（纯 Python，无控制台窗口；默认自动带起 Blender + Unity 桥）。
cd /d "%~dp0"
start "" pythonw "%~dp0start.py" --only frontend
exit /b
