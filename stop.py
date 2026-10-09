#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""停止 asset-browser 的服务（纯 Python，不依赖 PowerShell / bat）。

按端口结束监听进程：8099(前端) / 9877(Blender 桥) / 9878(Unity 桥)。

用法：
  python stop.py
"""
import subprocess


PORTS = [8099, 9877, 9878]


def _listening_pids(port):
    pids = set()
    try:
        out = subprocess.run(
            ["netstat", "-ano", "-p", "tcp"],
            capture_output=True, text=True, errors="ignore",
        ).stdout
    except FileNotFoundError:
        print("[stop] 找不到 netstat，无法定位进程")
        return pids
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
            if parts[1].endswith(":" + str(port)):
                pids.add(parts[4])
    return pids


def main():
    killed = 0
    for port in PORTS:
        for pid in _listening_pids(port):
            print(f"[stop] 结束 :{port} 上的进程 PID {pid}")
            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
            killed += 1
    print(f"[stop] 完成，共结束 {killed} 个进程")


if __name__ == "__main__":
    main()
