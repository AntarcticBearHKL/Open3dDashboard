# -*- coding: utf-8 -*-
"""serve.py — 托管前端(dist)与资源库，并默认自动带起本地桥。

  /            -> dist/（前端静态文件）
  /lib/        -> 资源库根目录（供前端 ?base=/lib/ 读取 manifest / fbx / 贴图）

默认同时启动 Blender 桥(:9877) 与 Unity 桥(:9878)。
用 --no-bridges 全部关闭，或 --no-blender / --no-unity 单独关闭。
对应端口已在监听则自动跳过，不会重复启动。

仅绑定 127.0.0.1。日志写 logs/serve.log（pythonw 无控制台时也能记录）。
"""
from __future__ import annotations

import argparse
import http.server
import os
import socket
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
DIST = os.path.join(PROJ, "dist")
LOGS = os.path.join(PROJ, "logs")

BRIDGES = [
    ("blender", 9877, os.path.join(PROJ, "bridge", "blender_bridge.py")),
    ("unity", 9878, os.path.join(PROJ, "bridge", "unity_bridge.py")),
]


def _ensure_stdio():
    if sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(LOGS, exist_ok=True)
    f = open(os.path.join(LOGS, "serve.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = f


def _port_in_use(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, port)) == 0


CREATE_NO_WINDOW = 0x08000000


def _windowless_python():
    exe = sys.executable or "python"
    if os.name == "nt" and exe.lower().endswith("python.exe"):
        cand = exe[: -len("python.exe")] + "pythonw.exe"
        if os.path.isfile(cand):
            return cand
    return exe


def _start_bridges(no_blender, no_unity):
    procs = []
    for name, port, script in BRIDGES:
        if name == "blender" and no_blender:
            continue
        if name == "unity" and no_unity:
            continue
        if _port_in_use(port):
            print(f"[serve] {name} 桥已在 :{port} 运行，跳过")
            continue
        if not os.path.isfile(script):
            print(f"[serve] 找不到 {name} 桥脚本：{script}")
            continue
        try:
            flags = CREATE_NO_WINDOW if os.name == "nt" else 0
            procs.append((name, subprocess.Popen([_windowless_python(), script], cwd=PROJ, creationflags=flags)))
            print(f"[serve] 已启动 {name} 桥 (:{port})")
        except Exception as exc:
            print(f"[serve] 启动 {name} 桥失败：{exc}")
    return procs


def _stop_bridges(procs):
    for _, proc in procs:
        if proc.poll() is None:
            proc.terminate()
    for _, proc in procs:
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


class Handler(http.server.SimpleHTTPRequestHandler):
    library_root = r"D:\3D Resource"

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p.startswith("/lib/"):
            return os.path.join(self.library_root, p[len("/lib/"):].replace("/", os.sep))
        if p in ("", "/"):
            p = "/index.html"
        return os.path.join(DIST, p.lstrip("/").replace("/", os.sep))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    _ensure_stdio()
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8099)
    ap.add_argument("--root", default=r"D:\3D Resource")
    ap.add_argument("--open", action="store_true")
    ap.add_argument("--no-bridges", action="store_true", help="不启动任何本地桥")
    ap.add_argument("--no-blender", action="store_true", help="不启动 Blender 桥")
    ap.add_argument("--no-unity", action="store_true", help="不启动 Unity 桥")
    a = ap.parse_args()

    Handler.library_root = a.root
    srv = Server((a.host, a.port), Handler)
    url = f"http://{a.host}:{a.port}/?base=/lib/"
    print(f"[serve] {url}  (dist={DIST}, lib={a.root})")

    bridges = [] if a.no_bridges else _start_bridges(a.no_blender, a.no_unity)

    if a.open:
        threading.Thread(target=lambda: (time.sleep(1.2), webbrowser.open(url)), daemon=True).start()

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        _stop_bridges(bridges)


if __name__ == "__main__":
    main()
