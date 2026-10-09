# -*- coding: utf-8 -*-
"""blender_bridge.py — 让“3D 资源浏览器”网页把 FBX 送进 Blender。

浏览器拿不到原生 TCP，也不能启动进程；这个仅本机的小桥负责两件事：
  GET  /health   -> 探测 Blender MCP addon（默认 localhost:9876）是否在线
  POST /import   -> 把 FBX 导入【已经打开】的 Blender（转发 execute 请求到 addon）
  POST /open     -> 用 blender.exe【新开】一个 Blender 并加载 FBX

只绑定 127.0.0.1，且只允许来自本页面的跨源请求（见 ALLOW_ORIGINS）。
用法:
  python blender_bridge.py [--port 9877] [--blender "D:\\...\\blender.exe"] [--addon-port 9876]
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOW_ORIGINS = {
    "http://localhost:5199",
    "http://127.0.0.1:5199",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8099",
    "http://127.0.0.1:8099",
}
DEFAULT_BLENDER = r"D:\SteamLibrary\steamapps\common\Blender\blender.exe"
ADDON = {"host": "127.0.0.1", "port": 9876}
BLENDER_EXE = DEFAULT_BLENDER
LOGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")


def _ensure_stdio() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(LOGS, exist_ok=True)
    f = open(os.path.join(LOGS, "bridge.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = f


def addon_request(code: str, timeout: float = 120.0) -> dict:
    payload = json.dumps({"type": "execute", "code": code, "strict_json": True}).encode("utf-8") + b"\0"
    with socket.create_connection((ADDON["host"], ADDON["port"]), timeout=8.0) as s:
        s.settimeout(timeout)
        s.sendall(payload)
        buf = bytearray()
        while b"\0" not in buf:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf.extend(chunk)
    idx = buf.find(b"\0")
    raw = bytes(buf[:idx] if idx >= 0 else buf)
    if not raw:
        raise RuntimeError("Blender addon did not respond")
    return json.loads(raw.decode("utf-8", "replace"))


def addon_alive() -> bool:
    try:
        with socket.create_connection((ADDON["host"], ADDON["port"]), timeout=1.5):
            return True
    except OSError:
        return False


def import_code(items: list) -> str:
    lines = ["import bpy", "import os",
             "imported = []", "errors = []",
             "scene = bpy.context.scene",
             "for _o in list(bpy.data.objects):",
             "    bpy.data.objects.remove(_o, do_unlink=True)"]
    for it in items:
        if isinstance(it, str):
            it = {"fbx": it}
        fbx = (it.get("fbx") or "").replace("\\", "/")
        root = (it.get("library_root") or "").replace("\\", "/")
        rel = (it.get("asset_rel") or "").replace("\\", "/")
        slug = it.get("slug") or ""
        code = it.get("code") or ""
        lines.append(
            "try:\n"
            "    try:\n"
            "        p = scene.assetlib\n"
            f"        p.library_root = r'{root}'\n"
            f"        p.asset_rel = r'{rel}'\n"
            f"        p.slug = r'{slug}'\n"
            f"        p.code = r'{code}'\n"
            "    except Exception:\n"
            "        pass\n"
            f"    bpy.ops.import_scene.fbx(filepath=r'{fbx}', global_scale=scene.unit_settings.scale_length)\n"
            f"    imported.append(r'{fbx}')\n"
            "except Exception as e:\n"
            f"    errors.append([r'{fbx}', str(e)])"
        )
    lines.append("result = {'imported': imported, 'errors': errors, 'count': len(imported)}")
    return "\n".join(lines)


class Handler(BaseHTTPRequestHandler):
    server_version = "asset-browser-blender-bridge"

    def _origin_ok(self) -> bool:
        origin = self.headers.get("Origin", "")
        return origin in ALLOW_ORIGINS

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOW_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")

    def _send(self, status: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if not self._origin_ok():
            self._send(403, {"error": "origin not allowed"})
            return
        if self.path.rstrip("/").endswith("/health"):
            alive = addon_alive()
            self._send(200, {
                "bridge": True,
                "blender": alive,
                "addon": f"{ADDON['host']}:{ADDON['port']}",
                "blender_exe": BLENDER_EXE,
            })
            return
        self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if not self._origin_ok():
            self._send(403, {"error": "origin not allowed"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:
            self._send(400, {"error": f"bad json: {e}"})
            return

        items = data.get("items")
        if not items:
            raw = data.get("paths") or ([data["path"]] if data.get("path") else [])
            items = [{"fbx": p} for p in raw]
        items = [it for it in items if isinstance(it, dict) and str(it.get("fbx", "")).lower().endswith(".fbx")]
        if not items:
            self._send(400, {"error": "no .fbx items given"})
            return

        route = self.path.rstrip("/")
        if route.endswith("/import"):
            if not addon_alive():
                self._send(200, {"ok": False, "blender": False,
                                 "error": "Blender is not open (MCP addon not listening). Open Blender and enable the addon first."})
                return
            try:
                resp = addon_request(import_code(items))
            except Exception as e:
                self._send(200, {"ok": False, "blender": True, "error": str(e)})
                return
            self._send(200, {"ok": resp.get("status") == "ok", "blender": True, "result": resp})
            return

        if route.endswith("/open"):
            code = import_code(items)
            try:
                subprocess.Popen([BLENDER_EXE, "--python-expr", code])
            except Exception as e:
                self._send(200, {"ok": False, "error": f"Could not launch Blender: {e}"})
                return
            self._send(200, {"ok": True, "opened": len(items), "blender_exe": BLENDER_EXE})
            return

        self._send(404, {"error": "not found"})

    def log_message(self, *args) -> None:
        pass


def main() -> int:
    global BLENDER_EXE
    _ensure_stdio()
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9877)
    ap.add_argument("--addon-host", default="127.0.0.1")
    ap.add_argument("--addon-port", type=int, default=9876)
    ap.add_argument("--blender", default=DEFAULT_BLENDER)
    a = ap.parse_args()
    ADDON["host"], ADDON["port"] = a.addon_host, a.addon_port
    BLENDER_EXE = a.blender
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"[bridge] http://{a.host}:{a.port}  (addon {a.addon_host}:{a.addon_port}, blender {BLENDER_EXE})")
    print(f"[bridge] Blender is {'online' if addon_alive() else 'not open'}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
