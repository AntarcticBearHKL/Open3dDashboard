@echo off
rem 后台启动两个桥：Blender(:9877) + Unity(:9878)（纯 Python，无控制台窗口）。
cd /d "%~dp0"
start "" pythonw "%~dp0start.py" --no-frontend
exit /b
