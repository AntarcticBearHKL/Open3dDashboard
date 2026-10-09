#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""asset-browser 一键启动（纯 Python，后台隐藏，无控制台窗口）。

默认启动「前端 + Blender 桥 + Unity 桥」。前端(serve.py)默认会自动带起两个桥。
所有子进程用 pythonw 无窗口方式运行，日志写到 logs/（start.log / serve.log / unity_bridge.log 等）。

启动前会先"无脑关闭"占用相关端口（前端端口 + 9877/9878）的进程，再重新启动；
用 --keep-existing 可跳过关闭。

用法：
  python start.py                    # 关掉旧的并全部重启（推荐）
  python start.py --keep-existing    # 不关旧的（占用则跳过）
  python start.py --no-open          # 不自动开浏览器
  python start.py --no-blender       # 不起 Blender 桥
  python start.py --no-unity         # 不起 Unity 桥
  python start.py --only frontend    # 只起前端（仍会自动带两个桥）
  python start.py --no-frontend      # 只起两个桥
  python start.py --only unity       # 只起 Unity 桥
停止用 python stop.py 或 stop-all.bat。
"""
import argparse
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LIB = r"D:\3D Resource"
BRIDGE_PORTS = {"blender": 9877, "unity": 9878}
CREATE_NO_WINDOW = 0x08000000


def _ensure_stdio():
    if sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)
    f = open(os.path.join(ROOT, "logs", "start.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = f


def _windowless_python():
    exe = sys.executable or "python"
    if os.name == "nt" and exe.lower().endswith("python.exe"):
        cand = exe[: -len("python.exe")] + "pythonw.exe"
        if os.path.isfile(cand):
            return cand
    return exe


PYW = _windowless_python()


def _spawn(script_args):
    flags = CREATE_NO_WINDOW if os.name == "nt" else 0
    return subprocess.Popen([PYW] + script_args, cwd=ROOT, creationflags=flags)


def _listening_pids(port):
    pids = set()
    try:
        out = subprocess.run(
            ["netstat", "-ano", "-p", "tcp"],
            capture_output=True, text=True, errors="ignore",
        ).stdout
    except FileNotFoundError:
        return pids
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
            if parts[1].endswith(":" + str(port)):
                pids.add(parts[4])
    return pids


def _kill_port(port):
    for pid in _listening_pids(port):
        print(f"[start] 关闭占用 :{port} 的旧进程 PID {pid}")
        subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)


def main():
    _ensure_stdio()
    ap = argparse.ArgumentParser(description="asset-browser 一键启动（Python，后台隐藏）")
    ap.add_argument("--only", choices=["frontend", "blender", "unity"], help="只启动其中一个")
    ap.add_argument("--port", type=int, default=8099, help="前端端口")
    ap.add_argument("--root", default=DEFAULT_LIB, help="3D 资源库根目录")
    ap.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    ap.add_argument("--no-frontend", action="store_true", help="不启动前端服务器")
    ap.add_argument("--no-blender", action="store_true", help="不启动 Blender 桥")
    ap.add_argument("--no-unity", action="store_true", help="不启动 Unity 桥")
    ap.add_argument("--keep-existing", action="store_true", help="不关闭已在运行的实例")
    args = ap.parse_args()

    os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)

    want_frontend = args.only in (None, "frontend") and not args.no_frontend
    will_blender = (not args.no_blender) and (want_frontend or args.only in (None, "blender"))
    will_unity = (not args.no_unity) and (want_frontend or args.only in (None, "unity"))

    if not args.keep_existing:
        ports = set()
        if want_frontend:
            ports.add(args.port)
        if will_blender:
            ports.add(BRIDGE_PORTS["blender"])
        if will_unity:
            ports.add(BRIDGE_PORTS["unity"])
        for port in sorted(ports):
            _kill_port(port)

    procs = []
    print("[start] asset-browser 启动中…")

    if want_frontend:
        serve_args = ["server/serve.py", "--port", str(args.port), "--root", args.root]
        if not args.no_open:
            serve_args.append("--open")
        if args.no_blender and args.no_unity:
            serve_args.append("--no-bridges")
        else:
            if args.no_blender:
                serve_args.append("--no-blender")
            if args.no_unity:
                serve_args.append("--no-unity")
        print("  → 前端服务器（默认自动带起 Blender + Unity 桥）")
        procs.append(("frontend", _spawn(serve_args)))
    else:
        if args.only in (None, "blender") and not args.no_blender:
            print("  → Blender 桥")
            procs.append(("blender", _spawn(["bridge/blender_bridge.py"])))
        if args.only in (None, "unity") and not args.no_unity:
            print("  → Unity 桥")
            procs.append(("unity", _spawn(["bridge/unity_bridge.py"])))

    if want_frontend:
        print(f"[start] 前端:      http://127.0.0.1:{args.port}/?base=/lib/  （桥随前端自动启动）")
    if will_blender:
        print("[start] Blender 桥: http://127.0.0.1:9877")
    if will_unity:
        print("[start] Unity 桥:   http://127.0.0.1:9878")
    print("[start] 已在后台运行（无窗口）。停止：python stop.py")

    try:
        while True:
            for name, proc in procs:
                if proc.poll() is not None:
                    print(f"[start] {name} 已退出（code={proc.returncode}）")
                    raise SystemExit(1)
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[start] 收到 Ctrl+C，正在停止…")
    finally:
        for _, proc in procs:
            if proc.poll() is None:
                proc.terminate()
        for _, proc in procs:
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
        print("[start] 已全部停止")


if __name__ == "__main__":
    main()
