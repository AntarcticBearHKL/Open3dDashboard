# 3D 资源库文件结构规范

> 面向**人**阅读的规范。库根：`D:\3D Resource`。
> Agent 执行规则见 [`.opencode/skills/3d-resource-structure/SKILL.md`](../.opencode/skills/3d-resource-structure/SKILL.md)。
> **本文件只写规范,不写实物数字**（资产数量 / 体积 / 各分类数量 / 贴图张数 / 风格分布等一律不写）。
> 实时数字看 `D:\3D Resource\_Catalog\stats.md`（由 `Script\stats_report.py` 生成）。

---

## 0. 数字从哪里来（重要）

- 规范文档（本文件、库根 `AGENTS.md`、Agent skill）**不得**出现会随库变化的数字。
- 需要数字时运行：

  ```bash
  python D:\3D Resource\Script\stats_report.py    # → _Catalog\stats.md / stats.json
  python D:\3D Resource\Script\validate.py         # → _Catalog\validate_report.md（结构 + 资源共享校验）
  ```

---

## 1. 这是什么

由多个第三方 3D 资源包（园林 / 岩石 / 建筑 / 道具 / 特效等）**完全打散、重新分类、单体化**后的地编资源库。

**四条核心原则：**

| 原则 | 含义 |
|---|---|
| **单体化** | 一个素材 = 一个自包含文件夹：模型（多 LOD 的 FBX）+ 预览图 + 元数据 json |
| **零原包痕迹** | 不保留任何原始资源包的目录结构或包名（来源只写进 json 的 `source_pack`） |
| **统一命名与分类** | 全部按第 4、5 节规则命名与归类 |
| **资源自包含** | 模型引用的贴图都在库内（**资产自身目录**或**共享池**，见第 8 节），不依赖库外路径 |

---

## 2. 顶层目录

```
D:\3D Resource\
├── AGENTS.md                     库的使用说明书（规范）
├── Script\                       管理脚本（Python 3.10）
├── _Catalog\                     索引与日志（manifest / codes / 贴图映射 / 统计 / 校验报告）
├── _textures\                    共享贴图池（只放被多个资产共用的贴图，见第 8 节）
├── _materials\                   分层材质 blend（非资产）
│
├── Architecture\                 建筑构件
├── Creature\                     生物
├── FX\                           特效
├── Misc\                         杂项（目录保留，可暂空）
├── Prop\                         道具
├── Rock\                         岩石
├── Stone\                        石作
├── Terrain\                      地形
├── Vegetation\                   植被
└── Wood\                         木作
```

**约定**：以 `_` 开头的目录（`_Catalog` / `_textures` / `_materials` …）与 `Script` **一律不是资产大类**；其余一级目录都按大类扫描。判断函数见 `Script/config.py::is_category_dir()`。

---

## 3. 单资产结构

**一个资产 = 一个文件夹**，位于 `<大类>\<子类>\<slug>\`：

```
<大类>\<子类>\<slug>\
    ├── <slug>.fbx               LOD0
    ├── <slug>_LOD1.fbx          其余 LOD（有则列出，从 1 起、连续）
    ├── <slug>.png               预览图，512×512，与资产同名
    ├── <slug>.json              元数据（见第 7 节）
    └── Textures\                可选：**仅该资产自用**的贴图（见第 8 节）
```

**要点**

- 模型统一为 `.fbx`，**全部为二进制**（`bpy.ops.import_scene.fbx` 可直接导入）。
- **LOD 拆开存放**：主文件 `<slug>.fbx` **只含 LOD0**，其余为 `<slug>_LODn.fbx`（从 1 起）。
- **贴图**：自用的放资产自身目录（`Textures\`），被多个资产共用的放共享池 `_textures\`（见第 8 节）；FBX 内用库内相对路径引用，打开即带材质。
- 碰撞体（collision）不保留。

---

## 4. 命名规范

**slug**：全小写 ASCII，下划线分词，结构 `<类型前缀>_<特征>[_<变体>]`。

- 类型前缀示例：`tree` / `grass` / `bamboo` / `rock` / `rock_cliff` / `arch_beam` / `arch_fence` / `prop_furniture` / `prop_deco` / `fx` / `water` …
- LOD 后缀：主文件 `<slug>.fbx`；其余 `<slug>_LOD1.fbx`、`<slug>_LOD2.fbx` …
- 预览图：与资产同名 `<slug>.png`。
- **同一子类内 slug 唯一**（全库亦唯一）。

**原始素材命名**（fbx / 贴图的源文件名）保留在 json 的 `name_original` 中，不体现在目录上。

---

## 5. 分类体系（两级）

**大类（L1）**：`Terrain` · `Rock` · `Stone` · `Vegetation` · `Wood` · `Architecture` · `Prop` · `Creature` · `FX` · `Misc`

**子类（L2）**：

| 大类 (L1) | 子类 (L2) |
|---|---|
| `Terrain` | Backdrop · Sky |
| `Rock` | Cliff · Stone · Boulder · Monument |
| `Stone` | Bracket · Beam · BuildingPart · Road · Statue · Building · Fence |
| `Vegetation` | Tree · Grass · Flower · GroundCover · Fungus · Detail · Bamboo · Bush · Berry · Fern |
| `Wood` | Beam · BuildingPart · Fence · Road · Building |
| `Architecture` | Beam · BuildingPart · Fence |
| `Prop` | Decoration · Material · Container · Furniture · Group · Food · Vehicle · Tool · Part · Structure |
| `Creature` | Animal · Insect |
| `FX` | Mesh · Billboard |
| `Misc` | Other |

> 分类依据「资产**是什么**」而非「来自哪个包」。
> ⚠️ `Rock/Stone`（岩石大类里的自然石）与 `Stone/*`（石作大类，含 Beam / Bracket 等构件）是**两个不同的分类**，勿混。
> 各分类实时数量见 `_Catalog\stats.md`。

### 风格分级标签（5 档）

按**预览图实际效果**分 5 档，**每个资产恰有 1 个**风格标签（写入 json 的 `tags`）：

| 档 | 标签 | 含义 |
|---|---|---|
| 1 | `lowpoly` | 极简低模：平面着色 / 块面，无写实贴图 |
| 2 | `stylized` | 风格化：手绘 / 卡通 / 简化的形体 |
| 3 | `semi-realistic` | 半写实：有细节的风格化，或写实贴图 + 简化几何 |
| 4 | `realistic` | 写实：自然形体，可信 PBR 材质 |
| 5 | `photoreal` | 照片级 / 扫描级细节 |

> 全库分布见 `_Catalog\stats.md`。

**透明标签（`alpha`）**：用 Pillow 实读 BASE/DIFFUSE 贴图 alpha，**透明像素占比 > 1%** 才算“用了透明”（仅“有 alpha 通道”不算）；这类资产 json `tags` 含 `alpha`，json/`manifest.json` 带 `"alpha": true`。工具：`Script\tag_transparency.py`（默认 dry-run，`--apply` 落地）。Unity 导入 `alpha=true` 的资产默认 **Transparent 表面 + 双面渲染 + Smoothness 0**；无透明需求的资产不要开透明。

---

## 6. 资产编号（code）

每个资产有一个稳定编号 `大类前缀-四位序号`，存于 `_Catalog\codes.json`（`{ "code": "slug" }`）。编号**只增不改、不复用**。

| 前缀 | 大类 | 前缀 | 大类 |
|---|---|---|---|
| `AR` | Architecture | `RO` | Rock |
| `CR` | Creature | `ST` | Stone |
| `FX` | FX | `TE` | Terrain |
| `PR` | Prop | `VE` | Vegetation |
| `WO` | Wood | — | Misc（可空） |

前端购物车导出的就是 `codes` 数组；导入脚本按 code 到 `codes.json` 反查 slug / 路径。

---

## 7. 元数据 JSON（`<slug>.json`）

```json
{
  "id": "<slug>",
  "name": "<slug>",
  "name_original": "<原素材名>",
  "code": "<前缀>-<序号>",
  "category": "<大类>/<子类>",
  "tags": ["…", "<风格标签>"],
  "description": "……",

  "lods": ["<slug>.fbx", "<slug>_LOD1.fbx"],

  "textures": ["_textures/<大类>/<名>.png", "<slug>/Textures/<名>.png"],
  "textures_by_kind": { "diffuse": [], "normal": [], "mask": [], "ao": [], "height": [], "other": [] },
  "texture_storage": "shared:_textures",   // 或 "local:<slug>" / "none"
  "untextured": false,

  "tri_count": 0,
  "dimensions_m": { "width": 0, "height": 0, "depth": 0 },

  "source_pack": "<原包>",
  "source_unity_pack": "…",

  "material": {
    "shader": "urp/lit",
    "base_color": { "texture": "…", "color": [1, 1, 1, 1] },
    "normal":     { "texture": "…", "strength": 1.0 },
    "mask":       { "texture": "…" },
    "occlusion":  { "texture": "…", "strength": 1.0 },
    "height":     { "texture": "…" },
    "metallic": 0.0,
    "smoothness": 0.5
  }
}
```

**必填**：`id` `name` `category` `source_pack` `lods`。其余字段可空。
`textures` / `textures_by_kind` / `material.*.texture` 一律为**库内相对路径**（`_textures/…` 或 `<slug>/…`），库内不得出现 `D:\…` 等库外绝对路径。

---

## 8. 资源归属与共享规则（重要）

**结论：默认放资产自己的目录;只有被多个资产共用,才放共享池。**

| 引用情况 | 存放位置 | `texture_storage` |
|---|---|---|
| **仅 1 个资产使用**（自用） | **该资产自己的目录**（`<大类>\<子类>\<slug>\Textures\`） | `local:<slug>` |
| **≥ 2 个资产使用**（共享） | 共享池 `_textures\<大类>\` | `shared:_textures` |
| 确无贴图 | — | `none`（并 `untextured: true`） |

- 贴图实体与 json/FBX 内的引用路径必须一致，且都是库内相对路径。
- `Script\validate.py` 会核对并报告：
  - 池内只被 1 个资产引用的贴图 → 应改放该资产自身目录；
  - 被 ≥2 个资产引用却不在池内的贴图 → 应进池；
  - 同一贴图既在资产目录、又在池内重复 → 冗余，应二选一。
- 历史遗留：早期把**全部**贴图收进 `_textures\`；现按本规则逐步收敛，`validate.py` 给待办清单（**只报告,不自动搬**）。

---

## 9. 索引文件（`_Catalog\`）

| 文件 | 作用 |
|---|---|
| `manifest.json` | **前端主数据源**：每资产一条扁平记录 |
| `codes.json` | 编号 ↔ slug 映射 |
| `asset_textures.json` | slug → 贴图清单（按 kind 分类）+ `texture_storage` |
| `catalog.tsv` / `index.tsv` / `index.json` | 表格化 / 全量索引 |
| `inventory.json` / `classification.json` | 清点 / 分类结果 |
| `stats.json` / `stats.md` | **实时统计**（`stats_report.py` 生成） |
| `validate_report.json` / `validate_report.md` | **结构校验报告**（`validate.py` 生成） |
| `texture_map.json` / `unity_texture_map*.json` / `fbx_scan.json` | 解析期中间产物 |
| `thumbnails\` | 缩略图缓存 |

> 数据流：`Script` 扫描库 → 解析贴图 → 写 `asset_textures.json` → 生成 `manifest.json` / `codes.json` → 前端读取 `manifest.json`。

---

## 10. 预览图与 LOD 规则

**预览图**
- 文件名与资产同名：`<slug>.png`，尺寸统一 **512×512**，**绑定材质后重渲**（带贴图）。
- 由 Blender 无头渲染生成（自动取景 + 三点光 + 3/4 视角）。

**LOD**
- LOD0 永远在 `<slug>.fbx`；其余 `<slug>_LODn.fbx`（n 从 1 起、连续）。
- 全部 LOD 与主模型一样**已绑定贴图**、引用库内相对路径。

---

## 11. 新增 / 入库流程

1. **定位分类**：按「资产是什么」定 `<大类>/<子类>`（见第 5 节）。
2. **起 slug**：按第 4 节规则；确认在子类内唯一。
3. **建目录**：`<大类>\<子类>\<slug>\`。
4. **放模型**：LOD0 → `<slug>.fbx`；其余 → `<slug>_LODn.fbx`（拆开、二进制、绑好贴图）。
5. **放贴图**：**自用的**放资产自身目录 `Textures\`；**被 ≥2 个资产共用的**放 `_textures\<大类>\`（见第 8 节）。
6. **渲预览**：`<slug>.png`，512×512。
7. **写 json**：按第 7 节；贴图路径写库内相对路径。
8. **更新索引**：登记 `codes.json`（分配编号）、`asset_textures.json`、`manifest.json`（可重跑 `Script` 生成）。
9. **校验**：过第 12 节清单（或直接跑 `Script\validate.py`）。

> 也支持批量入库：把新资产丢进 `00_Inbox\` 再跑 `Script\import_inbox.py`（默认 dry-run，`--apply` 落地）。

---

## 12. 校验清单（Validate）

- [ ] 目录形如 `<大类>/<子类>/<slug>`，大类、子类都在第 5 节表内。
- [ ] 存在 `<slug>.fbx`（LOD0），且为二进制 FBX。
- [ ] LOD 命名 `_LODn`、从 1 连续；主文件不含其它 LOD。
- [ ] 存在 `<slug>.png`，512×512、与 slug 同名。
- [ ] 存在 `<slug>.json`，含必填字段。
- [ ] json 内贴图路径全部为库内相对路径，**无外部绝对路径**，且与第 8 节归属一致。
- [ ] 贴图实体存在（自身目录或 `_textures\<大类>\`）。
- [ ] 已在 `codes.json` / `asset_textures.json` / `manifest.json` 登记。
- [ ] slug 在子类内唯一。

> 一键校验：`python D:\3D Resource\Script\validate.py`

---

## 13. 已知偏差与注意

| 项 | 说明 |
|---|---|
| **历史遗留：全部贴图在共享池** | 早期把贴图统一收进 `_textures\`;按新规则应「自用放自身目录、共用才进池」,由 `validate.py` 逐步收敛 |
| **无贴图资产** | 源包缺失或本就是纯几何/特效网格 → json `untextured: true`、`texture_storage: none`,不影响几何使用 |
| **空目录** | 个别子类有目录无资产,属保留占位 |
| **授权** | 模型多为第三方付费资源,**仅限本项目内部使用,不得再分发** |
| **无 git** | 本库不使用版本控制;需要快照就手动备份 `_Catalog\` |

---

## 14. 管理脚本（`Script\`）

明细（含用法）见 `D:\3D Resource\Script\README.md`。

| 脚本 | 作用 |
|---|---|
| `config.py` | 全局配置：库根 / 大类 / 命名规则 / 扩展名；`is_category_dir()` |
| `stats_report.py` | **实时统计**：数量 / 体积 / 风格分布 / 遗留项 → `_Catalog\stats.md` |
| `validate.py` | **结构校验 + 资源共享核对** → `_Catalog\validate_report.md` |
| `find_duplicates.py` | 内容哈希去重报告 |
| `normalize_names.py` | 批量重命名到规范（默认 dry-run） |
| `import_inbox.py` | 把新资源从 `00_Inbox` 按规则归位入库 |
| `export_pack.py` | 按编号/slug 导出资产包 |
| `build_manifest.py` / `build_index.py` / `inventory.py` / `scan_index.py` | 扫描与索引 |
| `consolidate_textures.py` / `resolve_pack_naming.py` / `build_resolve_final.py` | 贴图解析与归置 |
| `apply_asset_jsons.py` / `blender_rebind_batch.py` / `blender_rebind_lods.py` | 回写 json / 无头绑材质 |
| `split_lods.py` | 拆分 FBX 内混合的 LOD |
| `rerender_previews.py` | Blender 无头批量渲染预览 |
