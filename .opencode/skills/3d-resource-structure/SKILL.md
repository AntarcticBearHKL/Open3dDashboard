---
name: 3d-resource-structure
description: Use when creating, importing, renaming, reorganizing, or validating files in the local 3D Resource library (D:\3D Resource) — picking the <大类>/<子类>/<slug> location, the slug, LOD files, preview PNG, <slug>.json metadata, texture self-use vs shared placement, and the _Catalog indexes (manifest.json / codes.json / asset_textures.json). Triggers: 3D Resource, 资源库, 单体化, asset library, slug, LOD, _textures, _Catalog, manifest.json, codes.json, asset_textures.json, 入库, 归位, 分类, 命名, 新资产, 添加资产.
---

# 3D 资源库 · 文件结构编排

本 skill 规定「在 `D:\3D Resource` 里新增 / 归位 / 重命名 / 校验资产文件」时必须遵守的结构与命名规则。
人读版规范：`docs/LIBRARY_STRUCTURE.md`（本仓库）。

## 何时使用

- 把新素材（下载 / 别人给的包 / 自己做的模型）**入库**到资源库
- **归位**：把散落文件放进正确的大类/子类目录
- **重命名**到规范 slug，或**拆分 LOD**
- 给资产**写 / 修 `<slug>.json`**、补 preview
- **校验**库结构，或**重建索引**（manifest / codes / asset_textures）
- 前端 asset-browser 依赖同样的结构，改动后需同步索引

## 铁律（MUST）

1. **单体化**：一个资产 = 一个文件夹 `<大类>\<子类>\<slug>\`，内含「模型 + 预览图 + json」。
2. **贴图归属**（见「决策三」）：**自用**贴图放资产自身目录 `Textures\`；**被 ≥2 个资产共用**的贴图才放共享池 `_textures\<大类>\`。绝不引用库外绝对路径。
3. **文件名 = slug**：`<slug>.fbx`（LOD0）、`<slug>_LODn.fbx`、`<slug>.png`、`<slug>.json`。
4. **命名与分类只依据本 skill**，不保留任何原始资源包的目录名或包名（包名只写进 json 的 `source_pack`）。
5. **slug 全库唯一、子类内唯一**；发现冲突必须先解决再入库。
6. **改完结构必须重建索引**，否则前端看不到（见下）。
7. **导入必须幂等**：同一次导入/放置请求即使被重试或重复触发，也不得产生第二份文件或第二个实例。

## MUST NOT

- ❌ 把**只被 1 个资产使用**的贴图放进共享池 `_textures\`（应放该资产自身目录）。
- ❌ 把**被 ≥2 个资产共用**的贴图放进某个资产的私有目录（应进 `_textures\`）。
- ❌ 把多个 LOD 混在一个 `.fbx` 里（必须拆成独立文件）。
- ❌ 用 `.obj`/`.blend`/`.gltf` 作为最终模型（统一 `.fbx`，二进制）。
- ❌ 把贴图写进 json 时用 `D:\…` 绝对路径。
- ❌ 改动 `<slug>` 后忘记同步 `codes.json` / `asset_textures.json` / `manifest.json`。
- ❌ 在**规范文档**（本 skill / `LIBRARY_STRUCTURE.md` / 库根 `AGENTS.md`）里写会随库变化的**实物数字**（数量 / 体积 / 分布）——数字一律由 `Script\stats_report.py` 产出到 `_Catalog\stats.md`。
- ❌ 未经确认就批量重命名或移动已有资产（先在临时目录产出清单，让用户确认）。

## 决策一：放哪个大类 / 子类

按「资产**是什么**」判断，不按来源包。大类：

| 大类 | 放进这里的 | 子类 |
|---|---|---|
| `Terrain` | 地形底板、天空 | Backdrop · Sky |
| `Rock` | 自然岩石、崖体 | Cliff · Stone · Boulder · Monument |
| `Stone` | 石作构件（人工石） | Bracket · Beam · BuildingPart · Road · Statue · Building · Fence |
| `Vegetation` | 植被 | Tree · Grass · Flower · GroundCover · Fungus · Detail · Bamboo · Bush · Berry · Fern |
| `Wood` | 木作构件 | Beam · BuildingPart · Fence · Road · Building |
| `Architecture` | 建筑构件 | Beam · BuildingPart · Fence |
| `Prop` | 道具 | Decoration · Material · Container · Furniture · Group · Food · Vehicle · Tool · Part · Structure |
| `Creature` | 生物 | Animal · Insect |
| `FX` | 特效网格 / 面片 | Mesh · Billboard |

归位后**立刻**给每个资产打 1 个风格标签（写进 json `tags`）：`lowpoly` / `stylized` / `semi-realistic` / `realistic` / `photoreal`。

**透明标签**：用 Pillow 实读 BASE 贴图 alpha，透明像素占比 > 1% 才算用了透明；这类资产 `tags` 含 `alpha` 且 json/manifest 带 `"alpha": true`。工具：`Script\tag_transparency.py`（默认 dry-run，`--apply` 落地）。Unity 导入 `alpha=true` 的资产会自动 **Transparent + 双面 + Smoothness 0**；不透明的资产别开透明。

⚠️ `Rock/Stone`（自然石）≠ `Stone/*`（石作构件），别放混。

## 决策二：slug 与文件名

- slug：全小写 ASCII、下划线分词、`<类型前缀>_<特征>[_<变体>]`
  - 前缀示例：`tree` / `grass` / `bamboo` / `rock` / `rock_cliff` / `arch_beam` / `arch_fence` / `prop_furniture` / `prop_deco` / `fx` / `water`
- LOD：LOD0 = `<slug>.fbx`；其余 `<slug>_LOD1.fbx`、`<slug>_LOD2.fbx` …（从 1 起、连续，主文件**只含 LOD0**）
- 预览：`<slug>.png`，**512×512**，绑定材质后渲染（可用 Blender 无头，或 asset-browser 的 Blender 插件「更新预览图」）

## 决策三：贴图放哪 + 写 `<slug>.json`

**贴图归属**（关键）：

| 引用情况 | 位置 | `texture_storage` |
|---|---|---|
| 仅 1 个资产使用 | 该资产自身目录 `<slug>\Textures\` | `local:<slug>` |
| ≥ 2 个资产使用 | 共享池 `_textures\<大类>\` | `shared:_textures` |
| 无贴图 | — | `none` + `untextured: true` |

**json**：必填 `id` `name` `category` `source_pack` `lods`。建议完整：

```json
{
  "id": "<slug>", "name": "<slug>",
  "name_original": "<原素材名>",
  "code": "<前缀>-<序号>",
  "category": "<大类>/<子类>",
  "tags": ["…", "<风格标签>"],
  "description": "…",
  "lods": ["<slug>.fbx", "<slug>_LOD1.fbx"],
  "textures": ["_textures/<大类>/<贴图>", "<slug>/Textures/<贴图>"],
  "textures_by_kind": { "diffuse": [], "normal": [], "mask": [], "ao": [], "height": [], "other": [] },
  "texture_storage": "shared:_textures",
  "untextured": false,
  "tri_count": 0,
  "dimensions_m": { "width": 0, "height": 0, "depth": 0 },
  "source_pack": "<原包>",
  "source_unity_pack": "…",
  "material": { "shader": "urp/lit", "base_color": { "texture": "", "color": [1,1,1,1] }, "metallic": 0.0, "smoothness": 0.5 }
}
```

- 贴图路径**只能**是库内相对路径（`_textures/…` 或 `<slug>/…`）。
- `texture_storage` 与贴图实际位置一致（`local:<slug>` / `shared:_textures` / `none`）。

## 入库流程（按序执行）

1. 定分类 → `<大类>/<子类>`。
2. 起 slug，确认唯一（在 `codes.json` / `manifest.json` 里 grep slug）。
3. 建 `<大类>\<子类>\<slug>\`。
4. 模型：LOD0 → `<slug>.fbx`；其余拆成 `<slug>_LODn.fbx`（二进制）。
5. 贴图：自用 → 资产 `Textures\`；共用 → `_textures\<大类>\`。
6. 预览：渲 `<slug>.png` 512×512。
7. 写 `<slug>.json`（贴图路径与归属一致）。
8. 绑材质：确认 FBX 内贴图引用为库内相对路径（用 Blender 无头重导）。
9. 更新索引（见下）。
10. 过校验清单（或跑 `Script\validate.py`）。

> 批量入库：把资产丢进 `00_Inbox\`，跑 `python Script\import_inbox.py`（默认 dry-run，`--apply` 落地）。

## 更新索引（改结构后必做）

- `_Catalog\codes.json`：`{ "编号": "slug" }` —— 新资产分配编号（前缀见下表，序号四位补零）。编号**只增不改、不复用**。
- `_Catalog\asset_textures.json`：`{ slug: { category, name_original, textures:{diffuse/normal/mask/ao/height/other:[…]}, count, texture_storage } }`
- `_Catalog\manifest.json`：前端主数据源；优先**重跑脚本**生成而非手改。字段：`code, slug, id, l1, l2, category, path, tags, description, name_original, tri_count, dimensions_m, lods, textures, preview, n_tex, untextured`。

编号前缀：`AR` Architecture · `CR` Creature · `FX` FX · `PR` Prop · `RO` Rock · `ST` Stone · `TE` Terrain · `VE` Vegetation · `WO` Wood（Misc 可空）。

## 校验清单（收尾逐条核对）

- [ ] 路径 = `<大类>/<子类>/<slug>`，且大类子类都在表内
- [ ] `<slug>.fbx` 存在、二进制、只含 LOD0
- [ ] LOD 命名 `_LODn` 且从 1 连续
- [ ] `<slug>.png` 存在、512×512、同名
- [ ] `<slug>.json` 存在且含必填字段
- [ ] json 贴图路径全为库内相对路径、无绝对路径，且**归属正确**（自用 vs 共享）
- [ ] 贴图实体存在（自身目录或 `_textures\<大类>\`）
- [ ] `codes.json` / `asset_textures.json` / `manifest.json` 已登记
- [ ] slug 全库唯一

> 一键校验：`python D:\3D Resource\Script\validate.py`（结构 + 资源共享核对）

## 参考

- 人读规范：`docs/LIBRARY_STRUCTURE.md`
- 库内说明：`D:\3D Resource\AGENTS.md`
- 实时数字：`python D:\3D Resource\Script\stats_report.py` → `_Catalog\stats.md`（**不要手抄数字进文档**）
- 管理脚本：`D:\3D Resource\Script\`（扫描 / 贴图解析 / 绑材质 / 渲预览 / 建索引 / 校验）
- 前端：asset-browser 读取 `_Catalog\manifest.json`；购物车导出 `codes`，按 `codes.json` 反查
- 授权：第三方付费资源，**仅限本项目内部使用，不得再分发**
