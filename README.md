# 3D 资源浏览器 (asset-browser)

本地优先、纯前端的 3D 资源库浏览与挑选界面。点选你的 `3D Resource` 目录即可浏览全部
资产（标签 / 预览图 / 规格 / 贴图清单），选中项放进购物车，最后导出购物车里所有
mesh 的**编号**文本，交给脚本或 Agent 使用。

- 技术栈：Vite + 原生 JS（离线打包，无第三方运行时依赖，运行时不依赖 CDN）
- 无后端：浏览器直接用 File System Access API 读取本地目录；或静态托管后用 `?base=` 读取
- 资产编号：`大类前缀-顺序`，如 `AR-0001`、`VE-0502`、`RO-0341`
- 数据来源：资源库根目录下的 `_Catalog/manifest.json`

### 相关文档

- [`docs/LIBRARY_STRUCTURE.md`](docs/LIBRARY_STRUCTURE.md) —— 3D 资源库文件结构规范（写给人看）
- [`.opencode/skills/3d-resource-structure/SKILL.md`](.opencode/skills/3d-resource-structure/SKILL.md) —— 告诉 Agent 如何编排资源文件结构的 skill

---

## 一键启动（Windows，纯 Python）

| 文件 | 作用 |
|---|---|
| `start.py` | **推荐**：`python start.py` 启动「前端 + Blender 桥 + Unity 桥」，Ctrl+C 全停 |
| `start-all.bat` | 双击等价于 `python start.py` |
| `start-frontend.bat` | 启动前端（**默认自动带起两个桥**） |
| `start-bridge.bat` | 只启动本地桥（Blender :9877 + Unity :9878） |
| `stop.py` / `stop-all.bat` | 停止前端与桥（`python stop.py`） |

- 全部是纯 Python 脚本：`python start.py` 前台运行（实时日志，Ctrl+C 全停），`python stop.py` 按端口停止。
- **前端默认会自动带起 Blender 桥(:9877) 与 Unity 桥(:9878)**；对应端口已占用则跳过，不重复启动。用 `python start.py --no-bridges`（或 `--no-blender` / `--no-unity`）可关闭。
- **启动前会先"无脑关闭"占用这些端口的旧进程，再重新启动**（相当于自动 stop + start）；想复用已在运行的实例就加 `--keep-existing`。
- 前端服务同时托管 `dist/` 与资源库，默认地址 `http://127.0.0.1:8099/?base=/lib/`；**不用再单独起资源库服务器，也不用在页面里选目录**。
- 资源库路径默认 `D:\3D Resource`（`python start.py --root "…"` 可改）。
- Blender 桥需已打开并启用 Blender MCP addon（9876）；Unity 桥需 Unity 已打开并启用 Unity MCP（端口按项目自动推导，本项目为 26440）。

---

## 运行

```bash
cd D:\Dev\asset-browser
npm install
npm run dev            # http://localhost:5199
```

> File System Access API 需要安全上下文（`https` 或 `localhost`）。`npm run dev` 已是
> localhost。推荐用 **Chrome / Edge**。

构建静态版本：

```bash
npm run build          # 产物在 dist/
npm run preview
```

### 两种加载方式

1. **选择目录（推荐）**：打开页面 → 点「选择资源库目录」→ 选 `D:\3D Resource`
   （或它的上级 `D:\`，程序会自动寻找其中的 `3D Resource`）。
2. **HTTP 模式**：本页与资源库分处不同地址时用 `?base=`：

   ```bash
   # 终端 A：托管资源库（需允许跨源；简单静态服务器即可）
   npx serve "D:\3D Resource"
   # 终端 B：启动本应用
   npm run dev
   # 浏览器打开：
   #   http://localhost:5199/?base=http://localhost:3000/
   ```

   `?base=` 也接受相对地址（当页面与资源库同源时），例如 `/?base=/lib/`。

### 深链（直接打开某个资产）

```
http://localhost:5199/?base=/lib/&open=VE-0266      # 载入后自动打开 VE-0266
```

---

## 功能

- 网格浏览 2,052 个资产：编号铜牌、slug、全量标签；卡片操作（加入购物车 / 复制资产信息 / 导入 Blender）；分类、三角面、贴图数等规格在详情面板查看
- 搜索（编号 / slug / 原名 / 标签）、大类 / 子类下拉、标签筛选、"只看有贴图"、多种排序
- 点开资产 → **大幅预览图**（`<slug>.png`）+ 规格面板，底部有放大的 **「在 Blender 中打开」** 按钮
  - 浏览器的 3D 预览已**整体移除**（three.js 依赖已删除，详情包从 655KB 降到 ~4KB）；模型查看改由 Blender 完成
- 购物车：加入 / 移除 / 清空 / 全选当前筛选结果；随 localStorage 记忆
- **刷新**：
  - 顶栏 **「刷新」** —— 重新读取 `manifest.json`，重载整库信息与所有预览图；
  - **详情面板右上角** 的单资产刷新 —— 只重读该资产的 `<slug>.json` 并重取它的预览图（带时间戳防缓存），不用整库重载。改完 Blender 存回后点一下即可看到更新。
- **滚动行为**：切换大类 / 子类（以及标签、只看有贴图）会把列表**滚动归零**；点「刷新」时**保持当前滚动位置不变**（原地更新可见卡片，不重建列表）。
- **导出**：输出 JSON 文本（含 `codes` 编号数组）+ 复制 / 下载；**导出后自动清空购物车**

---

## 购物车导出格式

```json
{
  "version": 1,
  "generatedAt": "2026-10-05T13:52:00.000Z",
  "count": 2,
  "codes": ["AR-0001", "VE-0266"],
  "items": [
    {
      "code": "AR-0001",
      "slug": "arch_beam_balk_1_1",
      "l1": "Architecture", "l2": "Beam", "category": "Architecture/Beam",
      "path": "Architecture/Beam/arch_beam_balk_1_1",
      "fbx": "Architecture/Beam/arch_beam_balk_1_1/arch_beam_balk_1_1.fbx",
      "lods": ["arch_beam_balk_1_1.fbx"],
      "textures": ["_textures/Architecture/Wooden parts 1.png"]
    }
  ]
}
```

`codes` 就是"购物车中所有 mesh 的编号"。导入脚本按 `codes` 到
`D:\3D Resource\_Catalog\codes.json` 反查 slug / 路径即可。

---

## 发送到 Blender（本地桥）

浏览器不能开原生 TCP、也不能启动进程，所以配一个**仅本机**的小桥：

```bash
npm run bridge        # 启动两个本地桥（Blender :9877 + Unity :9878）
```

- 桥监听 `http://127.0.0.1:9877`，**只绑定本机**，且只接受本页面来源（见 `bridge/blender_bridge.py` 的 `ALLOW_ORIGINS`）。
- **导入**：转发 `execute` 请求到 Blender MCP addon（`127.0.0.1:9876`）→ 把 FBX 导入**已打开的** Blender 当前场景。
- **新窗口打开**：用 `blender.exe` 启动一个新的 Blender 并加载 FBX。
- 前端入口：
  - 顶栏 **Blender** 按钮 → 连接状态 + 配置（资源库根路径 / 桥地址）+ 购物车批量操作；
  - 详情面板 **Blender** 按钮 → 导入当前资产；
  - 购物车 **导入到 Blender** → 批量导入购物车。

前置条件：Blender 需打开并启用 **Blender MCP addon**（默认端口 9876）。贴图会按 FBX 内相对 `_textures\...` 路径自动解析。

> 安全：桥只绑 127.0.0.1 且校验 Origin，防止任意网页往你的 Blender 注入代码。默认允许 `localhost/127.0.0.1` 的 5199/5173/8099 端口；用其它端口请改 `ALLOW_ORIGINS`。

---

## Blender 插件：Asset Library Bridge

位置：`blender_addon/asset_library_bridge.py`（**v1.2.0**，已装进 Blender 并启用；改源码后需同步到 Blender 的 `scripts/addons/` 目录并重载插件）。面板在 **3D 视图 N 侧栏 → 「Asset Library」**（`3D View > Sidebar > Asset Library` 分类），共三个面板：

**「Asset Library」**（上）—— 当前资产的基础信息：资源库根目录、资产相对路径、编号、文件名、预览图尺寸，以及一行 `Asset: …`；另有一个 **Clear** 按钮用于解绑当前资产（未绑定资产时该面板不绘制任何内容）。

**「Library Actions」**（中）—— 两个按钮：

| 按钮 | 作用 |
|---|---|
| **Update Preview** | 截取**当前 3D 视口所见**画面，写回 `<资产>/<slug>.png`。拍摄模式固定为「所见」，无需选择。 |
| **Save to Library** | 导出 `<slug>.fbx`（相对路径指向 `_textures`）→ 贴图归入 `<库>/_textures/<大类>/` → 同步 `<slug>.json` 与 `_Catalog/asset_textures.json`。 |

**「Model Tools」**（下）—— 一个按钮：

| 按钮 | 作用 |
|---|---|
| **Reset Position to Origin** | 把选中的 mesh 对象移回世界原点 `(0, 0, 0)`。 |

工作流：前端点「在 Blender 中打开」→ 桥把 **资源库根目录 + 资产相对路径 + slug + 编号** 写进 `scene.assetlib`，并清空场景后导入该 FBX；面板顶部随之显示当前资产信息。

说明：保存时只处理**当前场景材质实际引用**的贴图；已在 `_textures` 内的贴图原地保留，场景外的会复制进池。保存会把当前场景（含你的手工修改）导出回资源库。

---

## 已知限制

- 浏览器不再渲染 3D；看模型请用「在 Blender 中打开」。
- HTTP 模式要求服务器允许跨源读取（CORS），否则读不到 `manifest.json`。
- 预览图为库内整图（512×512），网格不做缩略图变体。
