# -*- coding: utf-8 -*-
"""unity_bridge.py — 让“3D 资源浏览器”网页把资产放进正在打开的 Unity 编辑器。

浏览器拿不到原生 TCP，也不能启动进程；这个仅本机的小桥负责把网页请求转发到
Unity Editor 的 MCP REST API（默认 localhost:26440）：
  GET  /health -> 探测 Unity MCP REST API 是否在线
  POST /place  -> 调用 HKLGame.AssetLib.AssetLibraryBridge.PlaceBySlug(slug)
  POST /sync   -> 调用 HKLGame.AssetLib.AssetLibraryBridge.SyncLibrary()
  POST /export -> 调用 HKLGame.AssetLib.AssetLibraryBridge.ExportScene()

只绑定 127.0.0.1，且只允许来自本页面的跨源请求（见 ALLOW_ORIGINS）。
用法:
  python unity_bridge.py [--port 9878] [--unity-host http://localhost:26440]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOW_ORIGINS = {
    "http://localhost:5199",
    "http://127.0.0.1:5199",
    "http://localhost:8099",
    "http://127.0.0.1:8099",
}
DEFAULT_UNITY_HOST = "http://localhost:26440"
CONFIG_PATH = r"D:\Unity Projects\INE_PROJ1\UserSettings\AI-Game-Developer-Config.json"
UNITY = {"host": DEFAULT_UNITY_HOST, "token": ""}
CALL_TIMEOUT = 120.0  # script-execute 需要编译，给足时间
LOGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")


def _ensure_stdio() -> None:
    if sys.stdout is not None and sys.stderr is not None:
        return
    os.makedirs(LOGS, exist_ok=True)
    f = open(os.path.join(LOGS, "unity_bridge.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = f


def load_unity_config() -> tuple:
    """从 Unity MCP 配置里读出 host / token；文件缺失时回退默认。"""
    host = DEFAULT_UNITY_HOST
    token = ""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8-sig") as fh:
            cfg = json.load(fh)
        h = str(cfg.get("host") or "").strip()
        if h:
            host = h.rstrip("/")
        token = str(cfg.get("token") or "").strip()
    except Exception:
        pass
    return host, token


def unity_request(method: str, url: str, body: dict | None = None,
                  timeout: float = CALL_TIMEOUT) -> tuple:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if UNITY["token"]:
        req.add_header("Authorization", "Bearer " + UNITY["token"])
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def unity_alive() -> bool:
    try:
        status, _ = unity_request("GET", UNITY["host"] + "/api/tools", timeout=2.0)
        return status == 200
    except Exception:
        return False


def _csharp_literal(s: str) -> str:
    """把 Python 字符串转成 C# 字符串字面量（转义反斜杠与双引号）。"""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def make_code(call_expr: str) -> str:
    return ("public class AssetLibBridgeCall { public static string Run() { return "
            + call_expr + "; } }")


def extract_result(obj) -> str:
    """宽松解析 Unity script-execute 的返回，尽量取出字符串结果。"""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        structured = obj.get("structured")
        if isinstance(structured, dict):
            for key in ("result", "value", "message", "text"):
                v = structured.get(key)
                if isinstance(v, str):
                    return v
                if isinstance(v, dict):
                    for kk in ("value", "result", "text"):
                        vv = v.get(kk)
                        if isinstance(vv, str):
                            return vv
        result = obj.get("result")
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            for key in ("value", "result", "text", "message"):
                v = result.get(key)
                if isinstance(v, str):
                    return v
    return json.dumps(obj, ensure_ascii=False)


def call_tool(call_expr: str) -> dict:
    body = {
        "csharpCode": make_code(call_expr),
        "className": "AssetLibBridgeCall",
        "methodName": "Run",
        "isMethodBody": False,
    }
    url = UNITY["host"] + "/api/tools/script-execute"
    try:
        status, text = unity_request("POST", url, body=body, timeout=CALL_TIMEOUT)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"ok": False, "error": "Unity is not running or MCP is not ready (404)"}
        try:
            detail = e.read().decode("utf-8", "replace")
        except Exception:
            detail = ""
        return {"ok": False, "error": f"Unity MCP returned {e.code}: {detail[:400]}"}
    except Exception as e:
        return {"ok": False, "error": f"Unity is not running or MCP is not ready: {e}"}
    try:
        obj = json.loads(text)
    except Exception:
        return {"ok": False, "error": f"Unity returned non-JSON: {text[:400]}"}
    status = obj.get("status") if isinstance(obj, dict) else None
    result = extract_result(obj)
    if status not in (None, "success", "ok"):
        return {"ok": False, "error": result or text[:400]}
    return {"ok": True, "result": result}


class Handler(BaseHTTPRequestHandler):
    server_version = "asset-browser-unity-bridge"

    def _origin_ok(self) -> bool:
        origin = self.headers.get("Origin", "")
        # 浏览器跨源请求必带 Origin；空 Origin 只可能来自本机进程（桥只绑 127.0.0.1）。
        return origin == "" or origin in ALLOW_ORIGINS

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
            alive = unity_alive()
            self._send(200, {
                "ok": True,
                "unity": alive,
                "host": UNITY["host"],
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
        if not isinstance(data, dict):
            self._send(400, {"error": "body must be a json object"})
            return

        route = self.path.rstrip("/")
        if route.endswith("/place"):
            slug = str(data.get("slug") or "").strip()
            if not slug:
                self._send(400, {"ok": False, "error": "Missing slug"})
                return
            request_id = str(data.get("requestId") or "").strip()
            if request_id:
                call = ("HKLGame.AssetLib.AssetLibraryBridge.PlaceBySlug("
                        + _csharp_literal(slug) + ", " + _csharp_literal(request_id) + ")")
            else:
                call = "HKLGame.AssetLib.AssetLibraryBridge.PlaceBySlug(" + _csharp_literal(slug) + ")"
            print(f"[unity-bridge] place slug={slug} requestId={request_id or '-'}", flush=True)
            self._send(200, call_tool(call))
            return

        if route.endswith("/sync"):
            self._send(200, call_tool("HKLGame.AssetLib.AssetLibraryBridge.SyncLibrary()"))
            return

        if route.endswith("/export"):
            self._send(200, call_tool("HKLGame.AssetLib.AssetLibraryBridge.ExportScene()"))
            return

        self._send(404, {"error": "not found"})

    def log_message(self, *args) -> None:
        pass


def main() -> int:
    _ensure_stdio()
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=9878)
    ap.add_argument("--unity-host", default="")
    a = ap.parse_args()
    cfg_host, cfg_token = load_unity_config()
    UNITY["host"] = (a.unity_host or cfg_host).rstrip("/")
    UNITY["token"] = cfg_token
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"[unity-bridge] http://{a.host}:{a.port}  (unity {UNITY['host']})")
    print(f"[unity-bridge] Unity is {'online' if unity_alive() else 'not running / MCP not ready'}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
