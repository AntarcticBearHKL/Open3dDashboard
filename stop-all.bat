@echo off
rem 停止前端与本地桥（纯 Python，按端口 8099/9877/9878）。
python "%~dp0stop.py"
exit /b
